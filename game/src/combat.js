// combatSystem: hitscan shooting from the player's weapon. Raycasts against
// enemies, cops and traffic cars; headshots count double. Weapons have their
// own damage, fire rate, spread and ammo, and the player can swap with 1-4.
import * as THREE from 'three';
import { clamp } from './util.js';

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, rate: 0.28, spread: 0.012, range: 70, auto: false },
  smg: { name: 'SMG', damage: 18, rate: 0.09, spread: 0.03, range: 60, auto: true },
  shotgun: { name: 'Shotgun', damage: 16, rate: 0.85, spread: 0.09, range: 30, auto: false, pellets: 6 },
  rifle: { name: 'Rifle', damage: 52, rate: 0.16, spread: 0.006, range: 110, auto: false },
};

export function createCombatSystem(scene, effects, audio) {
  const raycaster = new THREE.Raycaster();
  let lastShot = 0;

  function shoot(now, origin, direction, weaponId, targets, onHit) {
    const weapon = WEAPONS[weaponId];
    if (!weapon || now - lastShot < weapon.rate) return false;
    lastShot = now;
    audio.shoot(weaponId);
    const muzzle = origin.clone().addScaledVector(direction, 1.2);
    muzzle.y += 0.1;
    effects.muzzleFlash(muzzle);
    const pellets = weapon.pellets || 1;
    for (let p = 0; p < pellets; p += 1) {
      const dir = direction.clone();
      dir.x += (Math.random() - 0.5) * weapon.spread * 2;
      dir.y += (Math.random() - 0.5) * weapon.spread * 2;
      dir.z += (Math.random() - 0.5) * weapon.spread * 2;
      dir.normalize();
      const end = origin.clone().addScaledVector(dir, weapon.range);
      effects.tracer(muzzle, end);
      raycaster.set(origin, dir);
      raycaster.far = weapon.range;
      // Test each target's body box.
      for (const target of targets) {
        if (!target.alive) continue;
        const box = new THREE.Box3(
          new THREE.Vector3(target.pos.x - 0.6, target.pos.y, target.pos.z - 0.6),
          new THREE.Vector3(target.pos.x + 0.6, target.pos.y + 2.1, target.pos.z + 0.6),
        );
        const hit = raycaster.ray.intersectBox(box, new THREE.Vector3());
        if (hit) {
          const headshot = hit.y > target.pos.y + 1.65;
          const damage = weapon.damage * (headshot ? 2 : 1);
          if (onHit) onHit(target, damage, hit);
          break;
        }
      }
    }
    return true; // fired (rate-limited shots return false above)
  }

  return { shoot, WEAPONS };
}
