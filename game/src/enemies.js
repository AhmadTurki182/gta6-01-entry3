// enemiesManager: rival crew gunmen. They sprint to the nearest cover point,
// pop out to fire in bursts, and one in each squad flanks wide while the
// others pin the player down. They drop cash when they fall.
import * as THREE from 'three';
import { clamp, mulberry32, pick, distance2D } from './util.js';

const JACKETS = [0x2a2a2a, 0x5a2a2a, 0x3a4a2a, 0x4a2a5a];

export function createEnemiesManager(scene, coverPoints, effects, audio) {
  const random = mulberry32(2026);
  const enemies = [];

  function buildMesh() {
    const group = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: pick(random, JACKETS) });
    const pants = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.42), jacket);
    torso.position.y = 1.15;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
    head.position.y = 1.85;
    group.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.56), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    cap.position.y = 2.05;
    group.add(cap);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), pants);
    legL.position.set(-0.18, 0.4, 0);
    group.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.18;
    group.add(legR);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.9), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.35, 1.3, 0.4);
    group.add(gun);
    return { group, legL, legR, gun };
  }

  function nearestCover(x, z, playerPos) {
    let best = null, bestScore = Infinity;
    for (const c of coverPoints) {
      const dPlayer = distance2D(c.x, c.z, playerPos.x, playerPos.z);
      const dMe = distance2D(c.x, c.z, x, z);
      if (dPlayer < 14) continue; // never take cover on top of the player
      const score = dMe + dPlayer * 0.2;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  function spawnSquad(x, z, count, hp = 60) {
    const squad = [];
    for (let i = 0; i < count; i += 1) {
      const { group, legL, legR } = buildMesh();
      group.position.set(x + (random() - 0.5) * 8, 0, z + (random() - 0.5) * 8);
      scene.add(group);
      const enemy = {
        group, legL, legR, pos: group.position,
        hp, maxHp: hp, alive: true,
        cover: null, state: 'advance', stateTimer: 1 + random() * 2,
        fireTimer: 1 + random(), burstLeft: 0, flanker: i === count - 1 && count > 2,
        phase: random() * 6, cashDrop: 40 + Math.floor(random() * 120),
      };
      enemies.push(enemy);
      squad.push(enemy);
    }
    return squad;
  }

  function update(dt, playerPos, onEnemyShoot) {
    for (const e of enemies) {
      if (!e.alive) continue;
      const dist = distance2D(e.pos.x, e.pos.z, playerPos.x, playerPos.z);
      e.stateTimer -= dt;
      e.fireTimer -= dt;
      if (e.state === 'advance') {
        if (!e.cover) e.cover = nearestCover(e.pos.x, e.pos.z, playerPos);
        const tx = e.flanker ? playerPos.x + 22 : (e.cover ? e.cover.x : playerPos.x);
        const tz = e.flanker ? playerPos.z + 14 : (e.cover ? e.cover.z : playerPos.z);
        const d = distance2D(e.pos.x, e.pos.z, tx, tz);
        if (d > 2) {
          const heading = Math.atan2(tx - e.pos.x, tz - e.pos.z);
          e.pos.x += Math.sin(heading) * 5.5 * dt;
          e.pos.z += Math.cos(heading) * 5.5 * dt;
          e.group.rotation.y = heading;
          e.phase += dt * 9;
          e.legL.rotation.x = Math.sin(e.phase) * 0.6;
          e.legR.rotation.x = -Math.sin(e.phase) * 0.6;
        } else {
          e.state = 'cover';
          e.stateTimer = 2.5 + random() * 3;
          e.legL.rotation.x = 0; e.legR.rotation.x = 0;
        }
      } else if (e.state === 'cover') {
        e.group.rotation.y = Math.atan2(playerPos.x - e.pos.x, playerPos.z - e.pos.z);
        if (e.stateTimer <= 0) {
          e.state = 'advance';
          e.cover = null;
          e.stateTimer = 1.5 + random() * 2;
        }
      }
      // Fire in bursts when the player is in range and roughly in front.
      if (dist < 46 && e.fireTimer <= 0) {
        if (e.burstLeft <= 0) {
          e.burstLeft = 3 + Math.floor(random() * 3);
          e.fireTimer = 0.55 + random() * 0.8;
        } else {
          e.burstLeft -= 1;
          e.fireTimer = 0.13;
          const from = new THREE.Vector3(e.pos.x, e.pos.y + 1.4, e.pos.z);
          const to = new THREE.Vector3(
            playerPos.x + (random() - 0.5) * 1.6,
            (playerPos.y || 0) + 1.2,
            playerPos.z + (random() - 0.5) * 1.6,
          );
          effects.tracer(from, to);
          effects.muzzleFlash(from);
          audio.shoot('smg');
          if (onEnemyShoot) onEnemyShoot(e, dist);
        }
      }
    }
  }

  function damageEnemy(enemy, amount, hitPos) {
    if (!enemy.alive) return false;
    enemy.hp -= amount;
    effects.blood(hitPos);
    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.group.visible = false;
      effects.blood(hitPos);
      return true;
    }
    return false;
  }

  function clearAll() {
    for (const e of enemies) scene.remove(e.group);
    enemies.length = 0;
  }

  function aliveCount() {
    return enemies.filter((e) => e.alive).length;
  }

  return { spawnSquad, update, damageEnemy, clearAll, aliveCount, enemies };
}
