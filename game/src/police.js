// policeManager: the Paloma Bay Police Department — a wanted system with
// five stars, patrol cars that chase, PIT and ram, roadblocks and spike
// strips from 3 stars, a helicopter with a searchlight from 4, and a SEARCH
// mode: break line of sight and the cops hunt your last known position while
// the heat cools off.
import * as THREE from 'three';
import { clamp, mulberry32, distance2D, angleLerp } from './util.js';
import { CAR_MODELS, buildCarMesh } from './vehicles.js';

export const WANTED_DECAY_SECONDS = 26;

export function createPoliceManager(scene, vehicles, colliders, effects, audio) {
  const random = mulberry32(31337);
  const cops = [];
  const spikes = [];
  const roadblocks = [];
  let wanted = 0;
  let heat = 0; // 0..100, fills the next star
  let searchTimer = 0;
  let lastSeen = null;
  let searching = false;
  let heli = null;
  let heliLight = null;
  let sirenTimer = 0;
  let spikeCooldown = 0;
  let roadblockCooldown = 0;

  function policeCarMesh() {
    const group = buildCarMesh({ name: 'Interceptor', color: 0x111111, top: 50, accel: 26 }, 0x1a1a1a);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.2, 4.42),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    stripe.position.y = 0.95;
    group.add(stripe);
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.4;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.x = 0.4;
    bar.add(red); bar.add(blue);
    bar.position.y = 1.62;
    group.add(bar);
    group.userData.lightBar = bar;
    group.userData.red = red;
    group.userData.blue = blue;
    return group;
  }

  function spawnCop(x, z) {
    const mesh = policeCarMesh();
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const cop = {
      mesh, pos: mesh.position, heading: 0, speed: 0,
      state: 'chase', target: null, stuckTimer: 0, pitTimer: 0,
      lightPhase: Math.random() * 6, hp: 100, alive: true,
    };
    cops.push(cop);
    return cop;
  }

  function desiredCopCount() {
    return wanted === 0 ? 0 : wanted === 1 ? 2 : wanted === 2 ? 3 : wanted === 3 ? 4 : wanted === 4 ? 5 : 6;
  }

  function spawnCopNear(playerPos) {
    const angle = random() * Math.PI * 2;
    const dist = 70 + random() * 50;
    const x = clamp(playerPos.x + Math.sin(angle) * dist, -380, 380);
    const z = clamp(playerPos.z + Math.cos(angle) * dist, -380, 380);
    return spawnCop(x, z);
  }

  function spawnRoadblock(playerPos, playerHeading) {
    const ahead = 55;
    const cx = playerPos.x + Math.sin(playerHeading) * ahead;
    const cz = playerPos.z + Math.cos(playerHeading) * ahead;
    const group = [];
    for (const off of [-5, 5]) {
      const px = cx + Math.cos(playerHeading) * off;
      const pz = cz - Math.sin(playerHeading) * off;
      const cop = spawnCop(px, pz);
      cop.state = 'roadblock';
      cop.heading = playerHeading + Math.PI;
      cop.mesh.rotation.y = cop.heading;
      group.push(cop);
    }
    roadblocks.push({ cops: group, life: 25 });
  }

  function spawnSpikeStrip(playerPos, playerHeading) {
    const ahead = 40;
    const cx = playerPos.x + Math.sin(playerHeading) * ahead;
    const cz = playerPos.z + Math.cos(playerHeading) * ahead;
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.3, 1.2),
      new THREE.MeshBasicMaterial({ color: 0x888888 }),
    );
    strip.position.set(cx, 0.2, cz);
    strip.rotation.y = playerHeading + Math.PI / 2;
    scene.add(strip);
    spikes.push({ mesh: strip, x: cx, z: cz, life: 20 });
  }

  function spawnHeli(playerPos) {
    if (heli) return;
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 5), new THREE.MeshLambertMaterial({ color: 0x222831 }));
    group.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 6), new THREE.MeshLambertMaterial({ color: 0x222831 }));
    tail.position.set(0, 0.3, -5);
    group.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.15, 0.8), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1.1;
    group.add(rotor);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
    lamp.position.set(0, -1, 2);
    group.add(lamp);
    group.position.set(playerPos.x, 55, playerPos.z - 30);
    scene.add(group);
    heliLight = new THREE.SpotLight(0xfff2a8, 220, 90, 0.35, 0.4, 1);
    heliLight.position.copy(group.position);
    heliLight.target.position.set(playerPos.x, 0, playerPos.z);
    scene.add(heliLight);
    scene.add(heliLight.target);
    heli = { group, rotor, pos: group.position, hoverPhase: 0 };
  }

  function removeHeli() {
    if (!heli) return;
    scene.remove(heli.group);
    scene.remove(heliLight);
    heli = null;
    heliLight = null;
  }

  function addHeat(amount) {
    heat += amount;
    if (heat >= 100 && wanted < 5) {
      wanted += 1;
      heat = 0;
      searching = false;
      searchTimer = 0;
    }
  }

  function clearWanted() {
    wanted = 0;
    heat = 0;
    searching = false;
    searchTimer = 0;
    for (const cop of cops) scene.remove(cop.mesh);
    cops.length = 0;
    for (const s of spikes) scene.remove(s.mesh);
    spikes.length = 0;
    roadblocks.length = 0;
    removeHeli();
  }

  function canSee(playerPos, playerCar) {
    // Line of sight: no cop within 55 m with a clear-ish view counts as seen.
    // Simplified: seen if any chasing cop is within 60 m, or the heli is up.
    if (heli) return true;
    for (const cop of cops) {
      if (distance2D(cop.pos.x, cop.pos.z, playerPos.x, playerPos.z) < 60) return true;
    }
    return false;
  }

  function update(dt, player, playerCar, onBusted) {
    const playerPos = playerCar ? playerCar.pos : player.pos;
    const playerHeading = playerCar ? playerCar.heading : player.heading;
    const playerSpeed = playerCar ? Math.abs(playerCar.speed) : Math.abs(player.speed);

    // Wanted decay: only while unseen and not in a mission chase.
    if (wanted > 0) {
      if (canSee(playerPos, playerCar)) {
        lastSeen = { x: playerPos.x, z: playerPos.z };
        searchTimer = 0;
        if (searching) searching = false;
      } else {
        searchTimer += dt;
        if (searchTimer > 7 && !searching) searching = true;
        if (searching) {
          heat -= (100 / WANTED_DECAY_SECONDS) * dt * 0.4;
          if (heat <= -100) { wanted -= 1; heat = 0; }
          if (wanted <= 0) { clearWanted(); return { sirenNear: false }; }
        }
      }
    }

    // Reinforcements arrive until the wanted level's quota is met.
    while (cops.length < desiredCopCount()) spawnCopNear(playerPos);
    if (wanted >= 4) spawnHeli(playerPos);
    else if (wanted < 4) removeHeli();

    // Roadblocks and spike strips at 3+ stars.
    roadblockCooldown -= dt;
    spikeCooldown -= dt;
    if (wanted >= 3 && playerSpeed > 14 && roadblockCooldown <= 0) {
      spawnRoadblock(playerPos, playerHeading);
      roadblockCooldown = 18;
    }
    if (wanted >= 3 && playerCar && spikeCooldown <= 0 && playerSpeed > 16) {
      spawnSpikeStrip(playerPos, playerHeading);
      spikeCooldown = 14;
    }

    // Spike strips pop the player's tires.
    for (let i = spikes.length - 1; i >= 0; i -= 1) {
      const s = spikes[i];
      s.life -= dt;
      if (s.life <= 0) { scene.remove(s.mesh); spikes.splice(i, 1); continue; }
      if (playerCar && distance2D(playerCar.pos.x, playerCar.pos.z, s.x, s.z) < 5 && !playerCar.flatTire) {
        playerCar.flatTire = true;
        effects.sparks(playerCar.pos);
        audio.crash();
      }
    }
    for (let i = roadblocks.length - 1; i >= 0; i -= 1) {
      roadblocks[i].life -= dt;
      if (roadblocks[i].life <= 0) {
        for (const cop of roadblocks[i].cops) cop.state = 'chase';
        roadblocks.splice(i, 1);
      }
    }

    // Cop AI: chase, flank, PIT, or hold a roadblock.
    for (const cop of cops) {
      cop.lightPhase += dt * 9;
      const on = Math.sin(cop.lightPhase) > 0;
      cop.mesh.userData.red.material.color.setHex(on ? 0xff2222 : 0x551111);
      cop.mesh.userData.blue.material.color.setHex(on ? 0x112255 : 0x2244ff);
      const target = searching && lastSeen ? lastSeen : { x: playerPos.x, z: playerPos.z };
      const dist = distance2D(cop.pos.x, cop.pos.z, target.x, target.z);
      if (cop.state === 'roadblock') {
        cop.speed = 0;
        continue;
      }
      // Flanking: one in three cops aims 25 m to the player's side.
      const flank = (cops.indexOf(cop) % 3 === 2) && dist < 70;
      const tx = flank ? target.x + Math.cos(playerHeading) * 25 : target.x;
      const tz = flank ? target.z - Math.sin(playerHeading) * 25 : target.z;
      const desired = Math.atan2(tx - cop.pos.x, tz - cop.pos.z);
      cop.heading = angleLerp(cop.heading, desired, Math.min(1, dt * 2.2));
      const top = wanted >= 4 ? 46 : 42;
      const accel = dist > 25 ? 30 : 12;
      cop.speed = clamp(cop.speed + accel * dt, 0, top);
      const nx = cop.pos.x + Math.sin(cop.heading) * cop.speed * dt;
      const nz = cop.pos.z + Math.cos(cop.heading) * cop.speed * dt;
      cop.pos.x = nx;
      cop.pos.z = nz;
      cop.mesh.rotation.y = cop.heading;
      // PIT maneuver: when alongside a fast player car, shove its rear.
      cop.pitTimer -= dt;
      if (playerCar && dist < 6 && playerSpeed > 10 && cop.pitTimer <= 0) {
        playerCar.heading += 0.35;
        playerCar.speed *= 0.82;
        effects.sparks(playerCar.pos);
        audio.crash();
        cop.pitTimer = 3;
        cop.speed *= 0.6;
      }
      // Ram on foot: knock the player down (damage) when very close.
      if (!playerCar && dist < 2.2) {
        cop.speed = 0;
        player.takeDamage(8 * dt);
      }
      // Busted: a cop catches the player on foot at low speed.
      if (!playerCar && dist < 2.6 && playerSpeed < 2) {
        if (onBusted) onBusted();
      }
      // Stuck rescue: teleport a cop that has not closed distance in a while.
      cop.stuckTimer += dt;
      if (dist > 120) cop.stuckTimer += dt * 3;
      if (cop.stuckTimer > 14) {
        const angle = random() * Math.PI * 2;
        cop.pos.x = clamp(playerPos.x + Math.sin(angle) * 60, -380, 380);
        cop.pos.z = clamp(playerPos.z + Math.cos(angle) * 60, -380, 380);
        cop.stuckTimer = 0;
      } else if (dist < 40) {
        cop.stuckTimer = 0;
      }
    }

    // Helicopter hovers above the player and paints them with the searchlight.
    if (heli) {
      heli.hoverPhase += dt;
      heli.pos.x = playerPos.x + Math.sin(heli.hoverPhase * 0.4) * 18;
      heli.pos.z = playerPos.z - 24 + Math.cos(heli.hoverPhase * 0.3) * 12;
      heli.pos.y = 52 + Math.sin(heli.hoverPhase) * 3;
      heli.rotor.rotation.y += dt * 22;
      heli.group.rotation.y = Math.atan2(playerPos.x - heli.pos.x, playerPos.z - heli.pos.z);
      heliLight.position.copy(heli.pos);
      heliLight.target.position.set(playerPos.x, 0, playerPos.z);
      lastSeen = { x: playerPos.x, z: playerPos.z };
    }

    // Siren wail every few seconds while any cop is near.
    sirenTimer -= dt;
    const nearCop = cops.some((c) => distance2D(c.pos.x, c.pos.z, playerPos.x, playerPos.z) < 90);
    if (nearCop && sirenTimer <= 0) {
      audio.sirenBlip();
      sirenTimer = 2.4;
    }
    return { sirenNear: nearCop || !!heli };
  }

  return {
    update, addHeat, clearWanted, spawnCopNear,
    get wanted() { return wanted; },
    get heat() { return heat; },
    get searching() { return searching; },
    get cops() { return cops; },
    get heliUp() { return !!heli; },
    setWanted(level) { wanted = clamp(level, 0, 5); heat = 0; searching = false; searchTimer = 0; },
  };
}
