// createPlayer: Lena "Vex" Marlowe on foot — third-person WASD movement,
// mouse-orbit camera, sprint, jump, and a simple procedural body so the
// camera always has a character to follow.
import * as THREE from 'three';
import { clamp } from './util.js';
import { resolveCircle } from './city.js';

export function createPlayer(scene, colliders, spawn) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xc22a4a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), jacket);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
  head.position.y = 1.85;
  group.add(head);
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), hair);
  hairMesh.position.set(0, 1.92, -0.05);
  hairMesh.scale.set(1, 0.8, 1);
  group.add(hairMesh);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), jeans);
  legL.position.set(-0.18, 0.4, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.18;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.26), jacket);
  armL.position.set(-0.48, 1.15, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  group.add(armR);

  group.position.set(spawn.x, 0, spawn.z);
  scene.add(group);

  const player = {
    group, pos: group.position, heading: 0, speed: 0,
    health: 100, armor: 0, walkPhase: 0, onGround: true, vy: 0,
    weapon: 'pistol', ammo: { pistol: Infinity, smg: 120, shotgun: 24, rifle: 60 },
    update(dt, input, camera, collidersList) {
      const sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
      const runSpeed = sprint ? 9.5 : 5.2;
      let mx = 0, mz = 0;
      if (input.keys.has('KeyW')) mz -= 1;
      if (input.keys.has('KeyS')) mz += 1;
      if (input.keys.has('KeyA')) mx -= 1;
      if (input.keys.has('KeyD')) mx += 1;
      const len = Math.hypot(mx, mz) || 1;
      mx /= len; mz /= len;
      // Movement is relative to the camera yaw.
      const cy = Math.atan2(camera.position.x - this.pos.x, camera.position.z - this.pos.z);
      const wx = (mx * Math.cos(cy) - mz * Math.sin(cy)) * -1;
      const wz = (mx * Math.sin(cy) + mz * Math.cos(cy)) * -1;
      const moving = mx !== 0 || mz !== 0;
      const targetSpeed = moving ? runSpeed : 0;
      this.speed = this.speed + (targetSpeed - this.speed) * Math.min(1, dt * 10);
      if (this.speed > 0.2) {
        this.pos.x += wx * this.speed * dt;
        this.pos.z += wz * this.speed * dt;
        this.heading = Math.atan2(wx, wz);
        this.walkPhase += dt * this.speed * 1.6;
        legL.rotation.x = Math.sin(this.walkPhase) * 0.7;
        legR.rotation.x = -Math.sin(this.walkPhase) * 0.7;
        armL.rotation.x = -Math.sin(this.walkPhase) * 0.5;
        armR.rotation.x = Math.sin(this.walkPhase) * 0.5;
      } else {
        legL.rotation.x = 0; legR.rotation.x = 0;
        armL.rotation.x = 0; armR.rotation.x = 0;
      }
      group.rotation.y = this.heading;
      if (input.keys.has('Space') && this.onGround) {
        this.vy = 6.5;
        this.onGround = false;
      }
      if (!this.onGround) {
        this.vy -= 18 * dt;
        this.pos.y += this.vy * dt;
        if (this.pos.y <= 0) { this.pos.y = 0; this.onGround = true; this.vy = 0; }
      }
      resolveCircle(collidersList, this.pos, 0.9);
      this.pos.x = clamp(this.pos.x, -395, 395);
      this.pos.z = clamp(this.pos.z, -395, 395);
    },
    takeDamage(amount) {
      if (this.armor > 0) {
        const absorbed = Math.min(this.armor, amount * 0.6);
        this.armor -= absorbed;
        amount -= absorbed;
      }
      this.health -= amount;
      return this.health <= 0;
    },
    heal(amount) { this.health = clamp(this.health + amount, 0, 100); },
    reset(spawnPoint) {
      this.pos.set(spawnPoint.x, 0, spawnPoint.z);
      this.health = 100;
      this.armor = 0;
      this.speed = 0;
    },
  };
  return player;
}
