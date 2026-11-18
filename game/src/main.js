// main: boots Paloma Bay, runs the game loop, and wires every system
// together — city, player, cars, traffic, pedestrians, police, enemies,
// combat, missions, economy, day/night, radio, HUD, and saves.
import * as THREE from 'three';
import { buildCity, districtAt, ROAD_LINES, DISTRICTS } from './city.js';
import { createPlayer } from './player.js';
import { createVehiclesManager, CAR_MODELS } from './vehicles.js';
import { createTrafficManager } from './traffic.js';
import { createPedestriansManager } from './pedestrians.js';
import { createPoliceManager } from './police.js';
import { createEnemiesManager } from './enemies.js';
import { createCombatSystem, WEAPONS } from './combat.js';
import { createEconomyManager, SHOPS } from './economy.js';
import { createDayNightCycle } from './daynight.js';
import { createAudioEngine } from './audio.js';
import { createEffectsManager } from './effects.js';
import { createHudManager } from './hud.js';
import { createSaveManager } from './save.js';
import { MISSIONS, getMission, ACTS } from './missions.js';
import { stageShot, shotAutopilot } from './shots.js';
import { clamp, distance2D, formatCash } from './util.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed') || 1);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xff9a4a);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

const city = buildCity(scene);
const audio = createAudioEngine();
const effects = createEffectsManager(scene);
const economy = createEconomyManager();
const player = createPlayer(scene, city.colliders, city.spawnPoints.hideout);
const vehicles = createVehiclesManager(scene, city.colliders);
const traffic = createTrafficManager(scene, vehicles);
const peds = createPedestriansManager(scene, city.colliders);
const police = createPoliceManager(scene, vehicles, city.colliders, effects, audio);
const enemies = createEnemiesManager(scene, city.coverPoints, effects, audio);
const combat = createCombatSystem(scene, effects, audio);
const daynight = createDayNightCycle(scene, city.streetLights, city.neonSigns);
const hud = createHudManager(document);
const saves = createSaveManager();

vehicles.spawnParkedCars();
traffic.init(14);
peds.init(26);
// The player's own Comet GT waits at the hideout.
const homeCar = vehicles.spawnCar(CAR_MODELS[0], 40, 120, Math.PI / 2, {});

const state = {
  screen: 'title',
  inCar: false,
  currentCar: null,
  aiming: false,
  firing: false,
  missionId: 0,
  completedMissions: [],
  stepIndex: 0,
  stepData: null,
  raceIndex: 0,
  raceTimer: 0,
  killTarget: 0,
  killCount: 0,
  surviveTimer: 0,
  tailTarget: null,
  tailTimer: 0,
  tailWarnTimer: 0,
  escapeTimer: 0,
  spawnTimer: 0,
  gameComplete: false,
  camYaw: 0,
  camPitch: 0.32,
  camDist: 9,
  dragging: false,
  lastX: 0,
  lastY: 0,
  timeScale: 15,
};

const input = { keys: new Set(), mouseDown: false };
let shot = null;
let frameCount = 0;
let clockTime = 17.5;
let shotStartTime = 0;

// ---------- input ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  input.keys.add(e.code);
  if (e.code === 'KeyE') onInteract();
  if (e.code === 'KeyM') toggleOverlay('mission-list');
  if (e.code === 'KeyB') toggleOverlay('shop-menu');
  if (e.code === 'KeyQ') hud.setRadio(audio.nextStation());
  if (e.code === 'Escape') togglePause();
  if (e.code === 'Enter' && state.screen === 'title') startGame(false);
  if (e.code.startsWith('Digit')) {
    const idx = Number(e.code.slice(5)) - 1;
    const ids = ['pistol', 'smg', 'shotgun', 'rifle'];
    const id = ids[idx];
    if (id && economy.state.ownedWeapons.includes(id)) {
      player.weapon = id;
      hud.setWeapon(WEAPONS[id].name, player.ammo[id]);
    }
  }
});
window.addEventListener('keyup', (e) => input.keys.delete(e.code));
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (e.button === 0) { state.firing = true; state.dragging = true; state.lastX = e.clientX; state.lastY = e.clientY; }
});
window.addEventListener('pointerup', () => { state.firing = false; state.dragging = false; });
window.addEventListener('pointermove', (e) => {
  if (!state.dragging) return;
  state.camYaw -= (e.clientX - state.lastX) * 0.005;
  state.camPitch = clamp(state.camPitch + (e.clientY - state.lastY) * 0.003, 0.05, 1.1);
  state.lastX = e.clientX; state.lastY = e.clientY;
});
canvas.addEventListener('wheel', (e) => {
  state.camDist = clamp(state.camDist + e.deltaY * 0.01, 6, 16);
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- overlays ----------
function showOverlay(id) {
  for (const el of document.querySelectorAll('.overlay')) el.classList.remove('show');
  if (id) document.getElementById(id).classList.add('show');
}
function toggleOverlay(id) {
  if (state.screen !== 'play') return;
  const el = document.getElementById(id);
  if (el.classList.contains('show')) { el.classList.remove('show'); return; }
  if (id === 'mission-list') renderMissionList();
  if (id === 'shop-menu') renderShop();
  showOverlay(id);
}
function togglePause() {
  if (state.screen === 'play') { state.screen = 'paused'; showOverlay('pause-menu'); }
  else if (state.screen === 'paused') { state.screen = 'play'; showOverlay(null); }
}

document.getElementById('btn-new').addEventListener('click', () => startGame(true));
document.getElementById('btn-continue').addEventListener('click', () => startGame(false));
document.getElementById('btn-resume').addEventListener('click', () => togglePause());
document.getElementById('btn-quit-title').addEventListener('click', () => {
  state.screen = 'title'; showOverlay('title-screen'); saveGame();
});
document.getElementById('btn-respawn').addEventListener('click', () => respawn());
document.getElementById('btn-close-missions').addEventListener('click', () => showOverlay(null));
document.getElementById('btn-close-shop').addEventListener('click', () => showOverlay(null));
document.getElementById('btn-play-again').addEventListener('click', () => {
  state.gameComplete = false;
  state.screen = 'play'; showOverlay(null);
});

function startGame(fresh) {
  audio.unlock();
  audio.startRadio();
  if (fresh) {
    saves.clear();
    economy.state.cash = 500;
    economy.state.ownedWeapons = ['pistol'];
    economy.state.ownedCars = ['Comet GT'];
    economy.state.respect = 0;
    for (const d of DISTRICTS) economy.state.standing[d.id] = 0;
    state.completedMissions = [];
    state.missionId = 0;
    player.reset(city.spawnPoints.hideout);
    daynight.time = 17.5;
  } else {
    const data = saves.load();
    if (data) applySave(data);
  }
  state.screen = 'play';
  showOverlay(null);
  hud.setRadio(audio.stationName());
  hud.toast(fresh ? 'Welcome to Paloma Bay, Vex. Mission 1 is waiting — press M.' : 'Welcome back to Paloma Bay, Vex.');
  if (fresh) startMission(1);
  else if (state.missionId > 0) startMission(state.missionId);
  else hud.setObjective('Press M to start the next mission', 'Free roam');
}

function showEnd(title, text, mode) {
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-text').textContent = text;
  document.getElementById('btn-respawn').style.display = mode === 'complete' ? 'none' : 'inline-block';
  document.getElementById('btn-play-again').style.display = mode === 'complete' ? 'inline-block' : 'none';
  showOverlay('end-screen');
}

function showWasted() {
  state.screen = 'dead';
  showEnd('WASTED', 'Vex is down. The clinic patches her up — for a price.', 'dead');
  audio.missionFail();
}

function applySave(data) {
  economy.state.cash = data.cash ?? 500;
  economy.state.ownedWeapons = data.ownedWeapons || ['pistol'];
  economy.state.ownedCars = data.ownedCars || ['Comet GT'];
  state.completedMissions = data.completedMissions || [];
  state.missionId = data.missionId || 0;
  if (data.standing) economy.state.standing = data.standing;
  economy.state.respect = data.respect || 0;
  player.ammo = data.ammo || player.ammo;
  if (data.time) daynight.time = data.time;
  if (data.playerPos) player.reset({ x: data.playerPos.x, z: data.playerPos.z });
}

function saveGame() {
  saves.save({
    cash: economy.state.cash,
    ownedWeapons: economy.state.ownedWeapons,
    ownedCars: economy.state.ownedCars,
    completedMissions: state.completedMissions,
    missionId: state.missionId,
    standing: economy.state.standing,
    respect: economy.state.respect,
    ammo: player.ammo,
    time: daynight.time,
    playerPos: { x: player.pos.x, z: player.pos.z },
  });
}

function respawn() {
  player.reset(city.spawnPoints.hills);
  economy.addCash(-Math.min(200, economy.state.cash * 0.1));
  police.clearWanted();
  state.screen = 'play';
  showOverlay(null);
  hud.toast('You wake up at the Coral Clinic. The bay is still yours — barely.');
}

// ---------- missions ----------
function currentMission() {
  return state.missionId ? getMission(state.missionId) : null;
}

function currentStep() {
  const m = currentMission();
  return m ? m.steps[state.stepIndex] : null;
}

function startMission(id) {
  const mission = getMission(id);
  if (!mission) return;
  state.missionId = id;
  state.stepIndex = 0;
  state.stepData = null;
  enemies.clearAll();
  setupStep();
  hud.toast('MISSION ' + id + ' — ' + mission.title + ': ' + mission.briefing);
  audio.pickup();
}

function setupStep() {
  const step = currentStep();
  const mission = currentMission();
  if (!step || !mission) return;
  state.stepData = { ...step };
  if (step.type === 'kill') {
    state.killTarget = step.count;
    state.killCount = 0;
    enemies.spawnSquad(step.x, step.z, step.count, 60);
    police.addHeat(20);
  }
  if (step.type === 'survive') {
    state.surviveTimer = step.duration;
    state.spawnTimer = 0;
    enemies.spawnSquad(step.x + 20, step.z, 3, 60);
  }
  if (step.type === 'race') {
    state.raceIndex = 0;
    state.raceTimer = step.timeLimit;
  }
  if (step.type === 'escape') {
    state.escapeTimer = step.duration;
    police.setWanted(Math.max(police.wanted, 3));
  }
  if (step.type === 'tail') {
    state.tailTimer = step.duration;
    state.tailWarnTimer = 0;
    const car = vehicles.spawnCar(CAR_MODELS[1], step.x, step.z, 0, {});
    state.tailTarget = car;
  }
  if (step.type === 'steal') {
    const model = step.id === 7 ? CAR_MODELS[4] : CAR_MODELS[3];
    const car = vehicles.spawnCar(model, step.x, step.z, Math.PI / 2, {});
    state.stepData.targetCar = car;
  }
  updateObjectiveLabel();
}

function updateObjectiveLabel() {
  const mission = currentMission();
  const step = currentStep();
  if (!mission || !step) { hud.setObjective(null); return; }
  let label = step.label;
  if (step.type === 'kill') label = label.replace(/\(\d+\/\d+\)/, `(${state.killCount}/${state.killTarget})`);
  if (step.type === 'race') {
    label = `Win the race — checkpoint ${state.raceIndex + 1}/${step.checkpoints.length} · ${Math.ceil(state.raceTimer)}s left`;
  }
  if (step.type === 'survive') label = `Survive — ${Math.ceil(state.surviveTimer)}s left`;
  if (step.type === 'escape') label = `Escape the police — ${Math.ceil(state.escapeTimer)}s left`;
  hud.setObjective(label, 'M' + mission.id + ' — ' + mission.title);
}

function objectivePosition() {
  const step = currentStep();
  if (!step) return null;
  if (step.type === 'race') {
    const cp = step.checkpoints[state.raceIndex];
    return cp ? { x: cp[0], z: cp[1] } : null;
  }
  if (step.type === 'tail' && state.tailTarget) return { x: state.tailTarget.pos.x, z: state.tailTarget.pos.z };
  if (step.x !== undefined) return { x: step.x, z: step.z };
  return null;
}

function advanceStep() {
  const mission = currentMission();
  state.stepIndex += 1;
  audio.pickup();
  if (state.stepIndex >= mission.steps.length) {
    completeMission(mission);
  } else {
    setupStep();
  }
}

function completeMission(mission) {
  const payout = economy.payout(mission.reward, mission.district);
  economy.addCash(payout);
  economy.addStanding(mission.district, 18);
  state.completedMissions.push(mission.id);
  state.missionId = 0;
  state.stepIndex = 0;
  enemies.clearAll();
  audio.missionComplete();
  hud.toast(`MISSION COMPLETE — ${mission.title}! +${formatCash(payout)} · ${districtAt(0, 0).name} standing up`);
  hud.showPopup('+' + formatCash(payout), '#7cff6a');
  saveGame();
  if (mission.id === 15) {
    state.gameComplete = true;
    state.screen = 'complete';
    showEnd('YOU OWN THE BAY', 'All 15 missions complete. Paloma Bay is yours, Vex — king of the bay.', 'complete');
  }
}

function failMission(reason) {
  const mission = currentMission();
  if (!mission) return;
  audio.missionFail();
  hud.toast('MISSION FAILED — ' + mission.title + ': ' + reason + ' Press M to retry.');
  enemies.clearAll();
  state.missionId = 0;
  state.stepIndex = 0;
}

function updateMission(dt) {
  const mission = currentMission();
  const step = currentStep();
  if (!mission || !step) return;
  const playerPos = state.inCar && state.currentCar ? state.currentCar.pos : player.pos;
  const dist = (x, z) => distance2D(playerPos.x, playerPos.z, x, z);

  if (step.type === 'goto' || step.type === 'talk' || step.type === 'pickup' || step.type === 'deliver') {
    if (dist(step.x, step.z) < 8) {
      if (step.type === 'pickup') hud.showPopup('Package secured', '#ffd94a');
      advanceStep();
    }
  } else if (step.type === 'steal') {
    const car = state.stepData.targetCar;
    if (car && state.inCar && state.currentCar === car) advanceStep();
    else if (car && dist(car.pos.x, car.pos.z) < 4) {
      enterCar(car);
      police.addHeat(40);
      hud.toast('Car stolen! The cops noticed — get out of here!');
    }
  } else if (step.type === 'drive') {
    if (dist(step.x, step.z) < 10) advanceStep();
  } else if (step.type === 'kill') {
    if (enemies.aliveCount() === 0 && state.killCount >= state.killTarget) advanceStep();
  } else if (step.type === 'race') {
    state.raceTimer -= dt;
    const cp = step.checkpoints[state.raceIndex];
    if (cp && dist(cp[0], cp[1]) < 12) {
      state.raceIndex += 1;
      audio.pickup();
      hud.showPopup(`Checkpoint ${state.raceIndex}/${step.checkpoints.length}`, '#7cff6a');
      if (state.raceIndex >= step.checkpoints.length) advanceStep();
    }
    if (state.raceTimer <= 0) failMission('Out of time on the race.');
    updateObjectiveLabel();
  } else if (step.type === 'survive') {
    state.surviveTimer -= dt;
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && enemies.aliveCount() < 6) {
      enemies.spawnSquad(step.x + (Math.random() - 0.5) * 40, step.z + (Math.random() - 0.5) * 40, 2, 60);
      state.spawnTimer = 9;
    }
    if (state.surviveTimer <= 0) advanceStep();
    updateObjectiveLabel();
  } else if (step.type === 'tail') {
    state.tailTimer -= dt;
    const car = state.tailTarget;
    if (car) {
      // The courier cruises the grid.
      car.speed = 11;
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      if (Math.random() < dt * 0.15) car.heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      const d = dist(car.pos.x, car.pos.z);
      if (d > 70) { failMission('You lost the courier.'); return; }
      if (d < 8) {
        state.tailWarnTimer += dt;
        if (state.tailWarnTimer > 3) { failMission('Spotted! The courier burned you.'); return; }
      } else state.tailWarnTimer = 0;
      if (state.tailTimer <= 0) {
        vehicles.removeCar(car);
        state.tailTarget = null;
        advanceStep();
      }
    }
    updateObjectiveLabel();
  } else if (step.type === 'escape') {
    state.escapeTimer -= dt;
    if (police.wanted === 0) advanceStep();
    if (state.escapeTimer <= 0 && police.wanted > 0) failMission('The police caught up with you.');
    updateObjectiveLabel();
  }
  if (step.type === 'kill') updateObjectiveLabel();
}

// ---------- interactions ----------
function nearestInteractable() {
  const pos = player.pos;
  const car = vehicles.nearestCar(pos, 5);
  if (car && !state.inCar) return { kind: 'car', car };
  for (const shop of SHOPS) {
    if (distance2D(pos.x, pos.z, shop.x, shop.z) < 6) return { kind: 'shop', shop };
  }
  return null;
}

function onInteract() {
  if (state.screen !== 'play') return;
  if (state.inCar) { exitCar(); return; }
  const target = nearestInteractable();
  if (!target) return;
  if (target.kind === 'car') {
    enterCar(target.car);
    if (target.car.parked) {
      police.addHeat(25);
      hud.toast('That car was not yours. The cops might have noticed…');
    }
  } else if (target.kind === 'shop') {
    renderShop(target.shop);
    showOverlay('shop-menu');
  }
}

function enterCar(car) {
  state.inCar = true;
  state.currentCar = car;
  car.isPlayer = true;
  car.parked = false;
  player.group.visible = false;
  audio.engineStart();
  audio.door();
}

function exitCar() {
  const car = state.currentCar;
  if (!car) return;
  car.isPlayer = false;
  const side = car.pos.clone();
  side.x += Math.cos(car.heading) * 3;
  side.z -= Math.sin(car.heading) * 3;
  player.pos.set(side.x, 0, side.z);
  player.group.visible = true;
  state.inCar = false;
  state.currentCar = null;
  audio.door();
}

// ---------- shops & mission list ----------
function renderMissionList() {
  const list = document.getElementById('mission-items');
  let html = '';
  const nextId = state.completedMissions.length + 1;
  for (const act of ACTS) {
    html += `<h3>${act.name}</h3><p class="dim">${act.summary}</p>`;
    for (const m of MISSIONS.filter((x) => x.act === act.id)) {
      const done = state.completedMissions.includes(m.id);
      const available = m.id === nextId || done;
      const status = done ? '✓ DONE' : available ? '▶ AVAILABLE' : '🔒 LOCKED';
      html += `<div class="mission-row ${done ? 'done' : ''}"><b>M${m.id} — ${m.title}</b><span>${formatCash(m.reward)} · ${status}</span><button data-mission="${m.id}" ${available && !done ? '' : 'disabled'}>Start</button></div>`;
    }
  }
  list.innerHTML = html;
  for (const btn of list.querySelectorAll('button[data-mission]')) {
    btn.addEventListener('click', () => {
      showOverlay(null);
      startMission(Number(btn.dataset.mission));
    });
  }
}

function renderShop(shop) {
  const el = document.getElementById('shop-items');
  const active = shop || SHOPS[0];
  let html = `<h3>${active.name}</h3><p class="dim">Cash: ${formatCash(economy.state.cash)}</p>`;
  if (active.kind === 'weapons') {
    for (const [id, price] of Object.entries({ smg: 1200, shotgun: 900, rifle: 2400 })) {
      const owned = economy.state.ownedWeapons.includes(id);
      html += `<div class="shop-row"><b>${WEAPONS[id].name}</b><span>${owned ? 'OWNED' : formatCash(price)}</span><button data-buy-weapon="${id}" ${owned ? 'disabled' : ''}>Buy</button></div>`;
      if (owned) html += `<div class="shop-row"><b>${WEAPONS[id].name} ammo +60</b><span>${formatCash(150)}</span><button data-buy-ammo="${id}">Buy</button></div>`;
    }
  } else if (active.kind === 'cars') {
    for (const model of CAR_MODELS) {
      const owned = economy.state.ownedCars.includes(model.name);
      html += `<div class="shop-row"><b>${model.name}</b><span>${owned ? 'OWNED' : formatCash(model.price)}</span><button data-buy-car="${model.name}" data-price="${model.price}" ${owned || model.price === 0 ? 'disabled' : ''}>Buy</button></div>`;
    }
    html += `<p class="dim">Owned cars can be collected at the garage — a fresh one spawns beside you.</p>`;
  } else {
    html += `<div class="shop-row"><b>Full heal</b><span>${formatCash(150)}</span><button data-buy-heal="1">Buy</button></div>`;
    html += `<div class="shop-row"><b>Body armor (100)</b><span>${formatCash(400)}</span><button data-buy-armor="1">Buy</button></div>`;
  }
  el.innerHTML = html;
  for (const btn of el.querySelectorAll('[data-buy-weapon]')) {
    btn.addEventListener('click', () => {
      if (economy.buyWeapon(btn.dataset.buyWeapon)) { hud.toast('Bought ' + WEAPONS[btn.dataset.buyWeapon].name); renderShop(active); refreshHud(); }
      else hud.toast('Not enough cash!');
    });
  }
  for (const btn of el.querySelectorAll('[data-buy-ammo]')) {
    btn.addEventListener('click', () => {
      if (economy.buyAmmo(btn.dataset.buyAmmo)) {
        player.ammo[btn.dataset.buyAmmo] += 60;
        hud.toast('Ammo restocked'); renderShop(active); refreshHud();
      } else hud.toast('Not enough cash!');
    });
  }
  for (const btn of el.querySelectorAll('[data-buy-car]')) {
    btn.addEventListener('click', () => {
      if (economy.buyCar(btn.dataset.buyCar, Number(btn.dataset.price))) {
        const model = CAR_MODELS.find((m) => m.name === btn.dataset.buyCar);
        vehicles.spawnCar(model, player.pos.x + 6, player.pos.z + 4, 0, {});
        hud.toast(btn.dataset.buyCar + ' is yours — it is parked beside you.');
        renderShop(active); refreshHud();
      } else hud.toast('Not enough cash!');
    });
  }
  for (const btn of el.querySelectorAll('[data-buy-heal]')) {
    btn.addEventListener('click', () => {
      if (economy.buyHealth()) { player.heal(100); hud.toast('Patched up.'); renderShop(active); refreshHud(); }
      else hud.toast('Not enough cash!');
    });
  }
  for (const btn of el.querySelectorAll('[data-buy-armor]')) {
    btn.addEventListener('click', () => {
      if (economy.buyArmor()) { player.armor = 100; hud.toast('Armored up.'); renderShop(active); refreshHud(); }
      else hud.toast('Not enough cash!');
    });
  }
}

// ---------- shooting ----------
function handleShooting(now) {
  if (!state.firing || state.inCar) { state.aiming = false; return; }
  state.aiming = true;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = camera.position.clone();
  const targets = [];
  for (const e of enemies.enemies) targets.push(e);
  for (const cop of police.cops) {
    if (cop.alive === undefined) { cop.alive = true; cop.hp = 100; }
    targets.push(cop);
  }
  const ammo = player.ammo[player.weapon];
  if (ammo !== Infinity && ammo <= 0) {
    hud.toast('Out of ammo — buy more at Ironworks (B).');
    state.firing = false;
    return;
  }
  const fired = combat.shoot(now, origin, dir, player.weapon, targets, (target, damage, hitPos) => {
    if (target.mesh?.userData?.lightBar) {
      target.hp -= damage;
      effects.blood(hitPos);
      if (target.hp <= 0 && target.alive) {
        target.alive = false;
        scene.remove(target.mesh);
        const i = police.cops.indexOf(target);
        if (i >= 0) police.cops.splice(i, 1);
        police.addHeat(30);
      }
      return;
    }
    const killed = enemies.damageEnemy(target, damage, hitPos);
    if (killed) {
      economy.addCash(target.cashDrop);
      hud.showPopup('+' + formatCash(target.cashDrop), '#7cff6a');
      if (currentStep()?.type === 'kill') state.killCount += 1;
      police.addHeat(8);
    }
  });
  if (fired) {
    if (player.ammo[player.weapon] !== Infinity) player.ammo[player.weapon] = Math.max(0, player.ammo[player.weapon] - 1);
    police.addHeat(2);
    peds.scare(player.pos, 45);
  }
}

// ---------- camera ----------
function updateCamera(dt) {
  const focus = state.inCar && state.currentCar ? state.currentCar.pos : player.pos;
  const heading = state.inCar && state.currentCar ? state.currentCar.heading : player.heading;
  const yaw = state.camYaw + heading;
  const pitch = state.camPitch;
  const dist = state.camDist;
  const tx = focus.x - Math.sin(yaw) * Math.cos(pitch) * dist;
  const tz = focus.z - Math.cos(yaw) * Math.cos(pitch) * dist;
  const ty = (focus.y || 0) + 2.2 + Math.sin(pitch) * dist;
  camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 8);
  camera.position.y += (ty - camera.position.y) * Math.min(1, dt * 8);
  camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 8);
  camera.lookAt(focus.x, (focus.y || 0) + 1.6, focus.z);
}

// ---------- HUD refresh ----------
function refreshHud() {
  hud.setWanted(police.wanted, police.searching);
  hud.setVitals(player.health, player.armor);
  hud.setCash(economy.state.cash);
  const focusPos = state.inCar && state.currentCar ? state.currentCar.pos : player.pos;
  const district = districtAt(focusPos.x, focusPos.z);
  hud.setClock(daynight.time, district.name, economy.state.standing[district.id]);
  hud.setSpeed(state.inCar && state.currentCar ? Math.abs(state.currentCar.speed) * 3.6 : 0, state.inCar);
  hud.setWeapon(WEAPONS[player.weapon].name, player.ammo[player.weapon]);
  hud.setCrosshair(state.aiming && !state.inCar);
}

// ---------- main loop ----------
let lastTime = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = clamp((now - lastTime) / 1000, 0.001, 0.05);
  lastTime = now;
  frameCount += 1;

  const keys = shot ? shotAutopilot(shot, gameContext()) : input.keys;
  const activeInput = { keys };

  if (state.screen === 'title') {
    // Slow cinematic orbit over golden-hour Paloma Bay.
    const t = now / 1000;
    camera.position.set(Math.sin(t * 0.05) * 260, 90, Math.cos(t * 0.05) * 260);
    camera.lookAt(0, 10, 0);
    daynight.update(dt, 0);
    hud.drawMinimap(
      { districts: DISTRICTS, roadLines: ROAD_LINES },
      player.pos, player.heading, null, [], traffic.traffic.map((t2) => t2.car),
    );
    renderer.render(scene, camera);
    if (shot && frameCount > 25 && now - shotStartTime > 3000) window.__shotReady = true;
    return;
  }

  if (state.screen === 'play') {
    const { time } = daynight.update(dt, state.timeScale);
    clockTime = time;

    if (state.inCar && state.currentCar) {
      vehicles.updatePlayerCar(state.currentCar, activeInput, dt, (impact) => {
        audio.crash();
        effects.sparks(state.currentCar.pos);
        player.takeDamage(impact * 0.2);
        police.addHeat(3);
      });
    } else {
      player.update(dt, activeInput, camera, city.colliders);
    }

    const siren = police.update(dt, player, state.inCar ? state.currentCar : null, () => {
      if (state.screen === 'play' && !state.inCar) {
        state.screen = 'busted';
        showEnd('BUSTED', 'The Paloma Bay PD caught you. Bail costs $200 — the bay is still out there.', 'busted');
        economy.addCash(-200);
        police.clearWanted();
        audio.busted();
      }
    });
    if (player.health <= 0 && state.screen === 'play') showWasted();
    traffic.update(dt, siren.sirenNear, state.currentCar);
    const danger = state.firing ? player.pos : null;
    peds.update(dt, danger, danger ? 45 : 0);
    enemies.update(dt, player.pos, (enemy, dist) => {
      const hitChance = clamp(0.42 - dist / 120, 0.05, 0.4);
      if (Math.random() < hitChance) {
        if (player.takeDamage(5 + Math.random() * 7)) showWasted();
      }
    });
    handleShooting(now / 1000);
    updateMission(dt);
    effects.update(dt);
    updateCamera(dt);
    refreshHud();
    const objective = objectivePosition();
    const focusPos = state.inCar && state.currentCar ? state.currentCar.pos : player.pos;
    const heading = state.inCar && state.currentCar ? state.currentCar.heading : player.heading;
    hud.drawMinimap(
      { districts: DISTRICTS, roadLines: ROAD_LINES },
      focusPos, heading, objective, police.cops, traffic.traffic.map((t) => t.car),
    );
    // Objective beacon: a tall golden pillar at the current target.
    updateBeacon(objective);
    if (shot && frameCount > 25 && now - shotStartTime > 6000) window.__shotReady = true;
  }

  renderer.render(scene, camera);
}

// Objective beacon mesh (one reusable pillar of light).
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(1.2, 1.2, 60, 10, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
);
beacon.visible = false;
scene.add(beacon);
function updateBeacon(objective) {
  if (!objective || state.screen !== 'play') { beacon.visible = false; return; }
  beacon.visible = true;
  beacon.position.set(objective.x, 30, objective.z);
}

function gameContext() {
  return {
    scene, player, vehicles, traffic, peds, police, enemies, daynight, economy, hud,
    state, enterCar,
  };
}

// ---------- shot staging ----------
if (shotName) {
  shotStartTime = performance.now();
  shot = stageShot(shotName, gameContext());
  if (shotName === 'start') {
    showOverlay('title-screen');
  } else {
    state.screen = 'play';
    showOverlay(null);
    audio.startRadio();
  }
  // In shot mode the game runs on its own; no title click needed.
} else {
  const data = saves.load();
  document.getElementById('btn-continue').style.display = data ? 'inline-block' : 'none';
  showOverlay('title-screen');
  if (new URLSearchParams(location.search).get('autostart') === '1') startGame(false);
}

// Debug hook (used by local playtests; harmless in the shipped game).
window.__paloma = { state, player, vehicles, police, economy, input };

requestAnimationFrame(loop);
