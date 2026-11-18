// stageShot: the four screenshot scenes. Each one stages a real, playable
// state of the game — the same world, the same rules — then hands the wheel
// to a small autopilot so the frame shows the game in motion. The first
// screenshot by name is the cover.
import { CAR_MODELS } from './vehicles.js';

function findModel(name) {
  return CAR_MODELS.find((m) => m.name === name) || CAR_MODELS[0];
}

export function stageShot(name, g) {
  const scene = g.scene;
  void scene;
  if (name === 'chase') {
    g.daynight.time = 17.6;
    const car = g.vehicles.spawnCar(findModel('Aurora Sport'), 0, 160, Math.PI, {});
    g.enterCar(car);
    car.speed = 26;
    g.police.setWanted(3);
    for (let i = 0; i < 3; i += 1) g.police.spawnCopNear(g.player.pos);
    g.hud.setObjective('Escape the police — lose your wanted level', 'Blockade Run');
    g.hud.toast('WANTED — 3 stars! Roadblock ahead!');
    return { autopilot: 'drive', target: { x: 0, z: -320 } };
  }
  if (name === 'mission') {
    g.daynight.time = 17.8;
    g.player.reset({ x: -240, z: -80 });
    g.player.heading = -Math.PI / 2;
    g.enemies.spawnSquad(-320, -80, 5, 60);
    g.police.setWanted(2);
    g.hud.setObjective('Clear out the Vultures (0/4)', 'First Blood');
    g.hud.toast('MISSION — First Blood: clear the container yard!');
    return { autopilot: 'aim', target: { x: -320, z: -80 } };
  }
  if (name === 'night') {
    g.daynight.time = 21.4;
    const car = g.vehicles.spawnCar(findModel('Comet GT'), 0, 240, Math.PI / 2, {});
    g.enterCar(car);
    car.speed = 30;
    g.police.setWanted(1);
    g.hud.setObjective('Win the street race — 6 checkpoints', 'Street Kings');
    g.hud.toast('RACE — Street Kings: checkpoint 2 of 6!');
    return { autopilot: 'drive', target: { x: 160, z: 240 } };
  }
  // start: the title screen over golden-hour Paloma Bay.
  g.daynight.time = 17.5;
  g.player.reset({ x: 24, z: 110 });
  g.hud.setObjective(null);
  return { autopilot: 'idle', target: null };
}

// Autopilot input for a staged scene: drive toward the target point,
// steering with A/D, or stand and face the target while aiming.
export function shotAutopilot(shot, g) {
  const keys = new Set();
  if (!shot) return keys;
  if (shot.autopilot === 'drive') {
    const car = g.state.currentCar;
    if (!car) return keys;
    keys.add('KeyW');
    const desired = Math.atan2(shot.target.x - car.pos.x, shot.target.z - car.pos.z);
    let diff = desired - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > 0.08) keys.add('KeyA');
    else if (diff < -0.08) keys.add('KeyD');
    return keys;
  }
  if (shot.autopilot === 'aim') {
    const desired = Math.atan2(shot.target.x - g.player.pos.x, shot.target.z - g.player.pos.z);
    g.player.heading = desired;
    g.state.aiming = true;
    return keys;
  }
  return keys;
}
