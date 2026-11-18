// pedestriansManager: Paloma Bay's crowds — shoppers, joggers, dock workers.
// They stroll the sidewalks, cross at intersections, and scatter, scream
// (a visible panic burst) and run when gunfire or a siren passes close by.
import * as THREE from 'three';
import { clamp, mulberry32, pick, distance2D } from './util.js';
import { ROAD_LINES } from './city.js';

const SHIRTS = [0xe86a1e, 0x2a7a9a, 0xc9c92a, 0x7a4a9a, 0x4a9a5a, 0xe8e8e8, 0x222222, 0xc22a4a];
const PANTS = [0x2a3a5a, 0x3a3a3a, 0x5a4a3a, 0x6a7a8a];

export function createPedestriansManager(scene, colliders) {
  const random = mulberry32(999);
  const peds = [];

  function buildPedMesh() {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pick(random, SHIRTS) });
    const pants = new THREE.MeshLambertMaterial({ color: pick(random, PANTS) });
    const skin = new THREE.MeshLambertMaterial({ color: pick(random, [0xd9a077, 0x8a5a34, 0xf2c9a0]) });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.36), shirt);
    torso.position.y = 1.1;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
    head.position.y = 1.75;
    group.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.28), pants);
    legL.position.set(-0.16, 0.38, 0);
    group.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.16;
    group.add(legR);
    return { group, legL, legR };
  }

  function spawnOne(x, z) {
    const { group, legL, legR } = buildPedMesh();
    group.position.set(x, 0, z);
    scene.add(group);
    const ped = {
      group, legL, legR, pos: group.position,
      heading: random() * Math.PI * 2,
      speed: 1.2 + random() * 0.9,
      panic: 0, phase: random() * 6, target: null,
      retargetTimer: 2 + random() * 4,
    };
    peds.push(ped);
    return ped;
  }

  function init(count) {
    for (let i = 0; i < count; i += 1) {
      const line = pick(random, ROAD_LINES);
      const along = -360 + random() * 720;
      const side = random() < 0.5 ? 10 : -10;
      if (random() < 0.5) spawnOne(along, line + side);
      else spawnOne(line + side, along);
    }
  }

  function scare(pos, radius) {
    for (const ped of peds) {
      if (distance2D(ped.pos.x, ped.pos.z, pos.x, pos.z) < radius) {
        ped.panic = 1;
        ped.heading = Math.atan2(ped.pos.x - pos.x, ped.pos.z - pos.z);
      }
    }
  }

  function update(dt, dangerPos, dangerRadius) {
    for (const ped of peds) {
      if (dangerPos && distance2D(ped.pos.x, ped.pos.z, dangerPos.x, dangerPos.z) < dangerRadius) {
        ped.panic = 1;
        ped.heading = Math.atan2(ped.pos.x - dangerPos.x, ped.pos.z - dangerPos.z);
      }
      if (ped.panic > 0) ped.panic = Math.max(0, ped.panic - dt * 0.25);
      const speed = ped.panic > 0 ? 6.5 : ped.speed;
      ped.retargetTimer -= dt;
      if (ped.retargetTimer <= 0 && ped.panic <= 0) {
        ped.retargetTimer = 3 + random() * 5;
        ped.heading += (random() - 0.5) * 1.6;
        // Stay near a road: drift toward the nearest grid line.
        const nearX = ROAD_LINES.reduce((a, b) => (Math.abs(ped.pos.x - b) < Math.abs(ped.pos.x - a) ? b : a));
        const nearZ = ROAD_LINES.reduce((a, b) => (Math.abs(ped.pos.z - b) < Math.abs(ped.pos.z - a) ? b : a));
        if (Math.abs(ped.pos.x - nearX) > 24 && Math.abs(ped.pos.z - nearZ) > 24) {
          ped.heading = Math.atan2(nearX - ped.pos.x, nearZ - ped.pos.z);
        }
      }
      ped.pos.x += Math.sin(ped.heading) * speed * dt;
      ped.pos.z += Math.cos(ped.heading) * speed * dt;
      ped.pos.x = clamp(ped.pos.x, -390, 390);
      ped.pos.z = clamp(ped.pos.z, -390, 390);
      ped.group.rotation.y = ped.heading;
      ped.phase += dt * speed * 1.8;
      ped.legL.rotation.x = Math.sin(ped.phase) * 0.6;
      ped.legR.rotation.x = -Math.sin(ped.phase) * 0.6;
    }
  }

  return { init, update, scare, peds, spawnOne };
}
