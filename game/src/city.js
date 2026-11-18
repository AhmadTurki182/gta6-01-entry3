// buildCity: Paloma Bay — a sun-soaked coastal city of five districts.
// Grid streets every 80 m, procedural stucco towers, palms, a marina, a pier,
// container docks, a neon strip, and the open ocean to the south.
import * as THREE from 'three';
import { mulberry32, pick } from './util.js';

export const CITY_HALF = 400;
export const ROAD_STEP = 80;
export const ROAD_LINES = [-320, -240, -160, -80, 0, 80, 160, 240, 320];

export const DISTRICTS = [
  { id: 'docks', name: 'Harbor Docks', color: '#8a7a5a', x0: -400, x1: -160, z0: -400, z1: 400 },
  { id: 'marina', name: 'Marina Bay', color: '#3f8f8a', x0: 160, x1: 400, z0: -400, z1: -80 },
  { id: 'hills', name: 'Coral Hills', color: '#c98a6a', x0: 160, x1: 400, z0: -80, z1: 400 },
  { id: 'neon', name: 'Neon Strip', color: '#c94f8a', x0: -160, x1: 160, z0: 160, z1: 400 },
  { id: 'oldtown', name: 'Old Town', color: '#d9a05a', x0: -160, x1: 160, z0: -400, z1: 160 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return DISTRICTS[4];
}

const PALETTE = [0xf2e3c6, 0xe8b48a, 0xd98a6a, 0xffffff, 0xc9d6dd, 0x9ab8c9, 0xe8c9a0, 0xb8a88a];
const NEON = [0xff2e88, 0x00e5ff, 0xffc400, 0x7cff00, 0xff6a00];

export function buildCity(scene) {
  const random = mulberry32(20261118);
  const colliders = [];
  const coverPoints = [];
  const streetLights = [];
  const neonSigns = [];
  const spawnPoints = {
    hideout: { x: 24, z: 120 },
    marina: { x: 320, z: -160 },
    docks: { x: -320, z: -80 },
    neon: { x: 0, z: 240 },
    beach: { x: -40, z: -340 },
    hills: { x: 240, z: 160 },
  };

  // Ground: grass/asphalt base, sand strip, and a big ocean plane to the south.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 80, CITY_HALF * 2 + 80),
    new THREE.MeshLambertMaterial({ color: 0x5a6b52 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 80, 64),
    new THREE.MeshLambertMaterial({ color: 0xe8d49a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, -368);
  scene.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 900),
    new THREE.MeshLambertMaterial({ color: 0x1d6f8e }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, -860);
  scene.add(ocean);

  // Asphalt roads: dark strips along every grid line, plus sidewalk kerbs.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2e33 });
  const kerbMat = new THREE.MeshLambertMaterial({ color: 0x8a8a80 });
  for (const line of ROAD_LINES) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 820 : 14, 0.1, horizontal ? 14 : 820), roadMat);
      road.position.set(horizontal ? 0 : line, 0.05, horizontal ? line : 0);
      scene.add(road);
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 820 : 15.5, 0.14, horizontal ? 15.5 : 820), kerbMat);
      kerb.position.set(horizontal ? 0 : line, 0.04, horizontal ? line : 0);
      scene.add(kerb);
    }
  }

  // Centre line dashes on every road.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
  const dashGeo = new THREE.BoxGeometry(6, 0.06, 0.7);
  for (const line of ROAD_LINES) {
    for (let p = -380; p < 380; p += 24) {
      const d1 = new THREE.Mesh(dashGeo, dashMat);
      d1.position.set(p, 0.12, line);
      scene.add(d1);
      const d2 = new THREE.Mesh(dashGeo, dashMat);
      d2.rotation.y = Math.PI / 2;
      d2.position.set(line, 0.12, p);
      scene.add(d2);
    }
  }

  // Buildings: one to four per block, heights by district, windows as emissive strips.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const mats = PALETTE.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const winGeo = new THREE.BoxGeometry(1, 1, 0.2);
  for (let bx = 0; bx < 9; bx += 1) {
    for (let bz = 0; bz < 9; bz += 1) {
      const cx = -320 + bx * 80 + 40;
      const cz = -320 + bz * 80 + 40;
      if (cz < -320) continue; // beachfront: no buildings on the sand
      if (bx === 4 && bz === 5) continue; // the hideout block stays open
      const district = districtAt(cx, cz);
      const tall = district.id === 'neon' ? 0.75 : district.id === 'marina' ? 0.5 : 0.2;
      const count = 1 + Math.floor(random() * (random() < tall ? 2 : 3));
      for (let i = 0; i < count; i += 1) {
        const w = 18 + random() * 22;
        const d = 18 + random() * 22;
        const h = district.id === 'neon' ? 26 + random() * 55
          : district.id === 'hills' ? 8 + random() * 12
          : district.id === 'docks' ? 10 + random() * 14
          : 12 + random() * (random() < tall ? 42 : 20);
        const ox = (random() - 0.5) * (64 - w);
        const oz = (random() - 0.5) * (64 - d);
        const x = cx + ox, z = cz + oz;
        const mesh = new THREE.Mesh(boxGeo, pick(random, mats));
        mesh.scale.set(w, h, d);
        mesh.position.set(x, h / 2, z);
        scene.add(mesh);
        colliders.push({ x, z, hx: w / 2, hz: d / 2 });
        coverPoints.push({ x: x + w / 2 + 2, z, kind: 'wall' });
        coverPoints.push({ x: x - w / 2 - 2, z, kind: 'wall' });
        // Rooftop box + lit windows on tall towers.
        if (h > 30) {
          const roof = new THREE.Mesh(boxGeo, pick(random, mats));
          roof.scale.set(w * 0.4, 4, d * 0.4);
          roof.position.set(x, h + 2, z);
          scene.add(roof);
          for (let wy = 8; wy < h - 4; wy += 9) {
            const win = new THREE.Mesh(winGeo, winMat);
            win.scale.set(w * 0.7, 1.6, 1);
            win.position.set(x, wy, z + d / 2 + 0.15);
            scene.add(win);
          }
        }
        // Neon signs on the strip.
        if (district.id === 'neon' && random() < 0.6) {
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(10 + random() * 8, 2.4, 0.6),
            new THREE.MeshBasicMaterial({ color: pick(random, NEON) }),
          );
          sign.position.set(x, 10 + random() * 18, z + d / 2 + 0.6);
          scene.add(sign);
          neonSigns.push(sign);
        }
      }
    }
  }

  // Harbor Docks: stacked shipping containers and two gantry cranes.
  const contColors = [0xc94f2e, 0x2e7fc9, 0x4fae4f, 0xc9a52e, 0x8a5ac9];
  for (let i = 0; i < 26; i += 1) {
    const x = -360 + random() * 180;
    const z = -300 + random() * 560;
    if (Math.abs(x % 80) < 12 || Math.abs(z % 80) < 12) continue;
    const c = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick(random, contColors) }));
    const w = 14, h = 4 + random() * 4, d = 5;
    c.scale.set(w, h, d);
    c.position.set(x, h / 2, z);
    c.rotation.y = random() < 0.5 ? 0 : Math.PI / 2;
    scene.add(c);
    colliders.push({ x, z, hx: w / 2 + 1, hz: d / 2 + 1 });
    coverPoints.push({ x: x + 9, z, kind: 'crate' });
  }
  for (const cz of [-160, 120]) {
    const crane = new THREE.Group();
    const legMat = new THREE.MeshLambertMaterial({ color: 0xd8a52e });
    for (const [lx, lz] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) {
      const leg = new THREE.Mesh(boxGeo, legMat);
      leg.scale.set(2, 42, 2);
      leg.position.set(lx, 21, lz);
      crane.add(leg);
    }
    const beam = new THREE.Mesh(boxGeo, legMat);
    beam.scale.set(70, 3, 4);
    beam.position.set(20, 42, 0);
    crane.add(beam);
    crane.position.set(-330, 0, cz);
    scene.add(crane);
    colliders.push({ x: -330, z: cz, hx: 10, hz: 8 });
  }

  // Marina: yacht masts and a wooden pier reaching into the ocean.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  for (let i = 0; i < 14; i += 1) {
    const plank = new THREE.Mesh(boxGeo, pierMat);
    plank.scale.set(10, 1, 8);
    plank.position.set(-120, 1.2, -400 - i * 8);
    scene.add(plank);
  }
  const mastMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
  for (let i = 0; i < 8; i += 1) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 18, 6), mastMat);
    mast.position.set(220 + random() * 120, 9, -330 - random() * 40);
    scene.add(mast);
  }

  // Lighthouse on the beach, the city's landmark.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 34, 10), lightMat);
  tower.position.set(-360, 17, -360);
  scene.add(tower);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
  lamp.position.set(-360, 36, -360);
  scene.add(lamp);
  colliders.push({ x: -360, z: -360, hx: 6, hz: 6 });

  // Palm trees along the beach and the strip.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8a4f });
  for (let i = 0; i < 70; i += 1) {
    const beach = i < 40;
    const x = beach ? -380 + random() * 760 : -160 + random() * 320;
    const z = beach ? -352 + random() * 16 : 160 + random() * 220;
    if (Math.abs(x % 80) < 10 || Math.abs(z % 80) < 10) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 6), trunkMat);
    trunk.position.set(x, 4.5, z);
    trunk.rotation.z = (random() - 0.5) * 0.2;
    scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(4.5, 5, 7), leafMat);
    leaves.position.set(x, 11, z);
    scene.add(leaves);
    colliders.push({ x, z, hx: 1, hz: 1 });
  }

  // Street lights on every intersection; they glow after dark.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const line of ROAD_LINES) {
    for (const other of ROAD_LINES) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 8, 6), poleMat);
      pole.position.set(line + 8, 4, other + 8);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), bulbMat);
      bulb.position.set(line + 8, 8.2, other + 8);
      scene.add(bulb);
      streetLights.push(bulb);
    }
  }

  // Hideout (player home) in Old Town: a low house with a garage and a garden wall.
  const house = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xe8b48a }));
  house.scale.set(20, 9, 16);
  house.position.set(24, 4.5, 132);
  scene.add(house);
  colliders.push({ x: 24, z: 132, hx: 10, hz: 8 });

  return { colliders, coverPoints, streetLights, neonSigns, spawnPoints };
}

export function collideCircle(colliders, x, z, radius) {
  for (const c of colliders) {
    const dx = x - Math.max(c.x - c.hx, Math.min(x, c.x + c.hx));
    const dz = z - Math.max(c.z - c.hz, Math.min(z, c.z + c.hz));
    if (dx * dx + dz * dz < radius * radius) return c;
  }
  return null;
}

export function resolveCircle(colliders, pos, radius) {
  const c = collideCircle(colliders, pos.x, pos.z, radius);
  if (!c) return false;
  const dx = pos.x - c.x, dz = pos.z - c.z;
  const px = c.hx + radius - Math.abs(dx);
  const pz = c.hz + radius - Math.abs(dz);
  if (px < pz) pos.x = c.x + (dx >= 0 ? c.hx + radius : -c.hx - radius);
  else pos.z = c.z + (dz >= 0 ? c.hz + radius : -c.hz - radius);
  return true;
}
