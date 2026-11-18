// vehiclesManager: every car in Paloma Bay — the player's rides, parked cars,
// and the traffic fleet. Arcade handling: throttle, brake/reverse, steering
// that tightens with speed, handbrake slides, and crash slowdowns.
import * as THREE from 'three';
import { clamp, mulberry32, pick, distance2D } from './util.js';
import { ROAD_LINES, resolveCircle } from './city.js';

export const CAR_MODELS = [
  { name: 'Comet GT', color: 0xd8222a, top: 52, accel: 26, price: 0 },
  { name: 'Vesper Sedan', color: 0x2a4a7a, top: 38, accel: 18, price: 2500 },
  { name: 'Bison Pickup', color: 0x8a6a2a, top: 36, accel: 16, price: 3200 },
  { name: 'Sirocco Coupe', color: 0x12b5a5, top: 48, accel: 24, price: 6500 },
  { name: 'Marauder Van', color: 0x555555, top: 32, accel: 14, price: 1800 },
  { name: 'Aurora Sport', color: 0xffc400, top: 56, accel: 28, price: 12000 },
  { name: 'Dune Buggy', color: 0xe86a1e, top: 42, accel: 22, price: 4800 },
];

const WHEEL_GEO = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);

export function buildCarMesh(model, colorOverride) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colorOverride ?? model.color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2a33 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
  cabin.position.set(0, 1.18, -0.2);
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, 2.0), paint);
  roof.position.set(0, 1.48, -0.2);
  group.add(roof);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(WHEEL_GEO, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2a8 });
  for (const lx of [-0.7, 0.7]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    light.position.set(lx, 0.7, 2.22);
    group.add(light);
  }
  return group;
}

export function createVehiclesManager(scene, colliders) {
  const random = mulberry32(777);
  const cars = [];
  let idCounter = 1;

  function spawnCar(model, x, z, heading, opts = {}) {
    const mesh = buildCarMesh(model, opts.color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = {
      id: idCounter++,
      model, mesh, pos: mesh.position,
      heading, speed: 0, steer: 0,
      isPlayer: false, isTraffic: !!opts.traffic, isPolice: !!opts.police,
      driver: opts.driver || null, parked: !!opts.parked,
      flatTire: false, health: 100, siren: false,
      brakeLight: null,
    };
    cars.push(car);
    return car;
  }

  function spawnParkedCars() {
    for (let i = 0; i < 18; i += 1) {
      const line = pick(random, ROAD_LINES);
      const along = -360 + random() * 720;
      const horizontal = random() < 0.5;
      const x = horizontal ? along : line + (random() < 0.5 ? 9 : -9);
      const z = horizontal ? line + (random() < 0.5 ? 9 : -9) : along;
      spawnCar(pick(random, CAR_MODELS), x, z, horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2), { parked: true });
    }
  }

  function nearestCar(pos, maxDist, exclude) {
    let best = null, bestD = maxDist;
    for (const car of cars) {
      if (exclude && car === exclude) continue;
      const d = distance2D(pos.x, pos.z, car.pos.x, car.pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function updatePlayerCar(car, input, dt, onCrash) {
    const top = car.flatTire ? car.model.top * 0.45 : car.model.top;
    const accel = car.model.accel;
    let throttle = 0;
    if (input.keys.has('KeyW')) throttle = 1;
    if (input.keys.has('KeyS')) throttle = -0.6;
    const handbrake = input.keys.has('Space');
    let steerInput = 0;
    if (input.keys.has('KeyA')) steerInput = 1;
    if (input.keys.has('KeyD')) steerInput = -1;
    const dir = car.speed >= 0 ? 1 : -1;
    car.steer = car.steer + (steerInput - car.steer) * Math.min(1, dt * 8);
    const steerAngle = car.steer * 0.55 * clamp(1 - Math.abs(car.speed) / 70, 0.35, 1) * (car.flatTire ? 0.6 : 1);
    car.heading += steerAngle * dir * clamp(Math.abs(car.speed) / 6, 0, 1) * dt * 2.2;
    if (throttle > 0) car.speed += accel * dt;
    else if (throttle < 0) {
      if (car.speed > 1) car.speed -= 34 * dt;
      else car.speed += accel * 0.6 * dt * throttle;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
    }
    if (handbrake) {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
    }
    car.speed = clamp(car.speed, -14, top);
    const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
    const before = { x: car.pos.x, z: car.pos.z };
    car.pos.x = nx;
    car.pos.z = nz;
    if (resolveCircle(colliders, car.pos, 2.2)) {
      const impact = Math.abs(car.speed);
      car.speed *= -0.25;
      if (impact > 12 && onCrash) onCrash(impact, before);
    }
    car.pos.x = clamp(car.pos.x, -395, 395);
    car.pos.z = clamp(car.pos.z, -395, 395);
    car.mesh.rotation.y = car.heading;
    const tilt = car.steer * clamp(Math.abs(car.speed) / 40, 0, 1) * 0.05;
    car.mesh.rotation.z = tilt;
  }

  return {
    cars, spawnCar, spawnParkedCars, nearestCar, updatePlayerCar,
    removeCar(car) {
      scene.remove(car.mesh);
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
    },
  };
}
