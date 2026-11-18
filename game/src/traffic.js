// trafficManager: civilian cars that cruise the grid, brake for the car ahead,
// and pull over to the kerb and stop when a police siren is wailing nearby.
import { clamp, mulberry32, pick, distance2D } from './util.js';
import { ROAD_LINES } from './city.js';
import { CAR_MODELS } from './vehicles.js';

export function createTrafficManager(scene, vehicles) {
  const random = mulberry32(4242);
  const traffic = [];

  function spawnTrafficCar() {
    const line = pick(random, ROAD_LINES);
    const along = -360 + random() * 720;
    const horizontal = random() < 0.5;
    const lane = random() < 0.5 ? 3.5 : -3.5;
    const x = horizontal ? along : line + lane;
    const z = horizontal ? line + lane : along;
    const heading = horizontal ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? Math.PI : 0);
    const model = pick(random, CAR_MODELS);
    const car = vehicles.spawnCar(model, x, z, heading, { traffic: true });
    const entry = {
      car, horizontal, lane,
      speed: 10 + random() * 6,
      targetSpeed: 12 + random() * 4,
      pullingOver: false,
    };
    traffic.push(entry);
    return entry;
  }

  function init(count) {
    for (let i = 0; i < count; i += 1) spawnTrafficCar();
  }

  function carAhead(entry) {
    let best = Infinity;
    for (const other of traffic) {
      if (other === entry) continue;
      const dx = other.car.pos.x - entry.car.pos.x;
      const dz = other.car.pos.z - entry.car.pos.z;
      const forward = dx * Math.sin(entry.car.heading) + dz * Math.cos(entry.car.heading);
      const lateral = Math.abs(dx * Math.cos(entry.car.heading) - dz * Math.sin(entry.car.heading));
      if (forward > 0 && forward < best && lateral < 3) best = forward;
    }
    return best;
  }

  function update(dt, sirenNear, playerCar) {
    for (const entry of traffic) {
      const car = entry.car;
      if (sirenNear) entry.pullingOver = true;
      else if (entry.speed < 0.5) entry.pullingOver = false;
      entry.targetSpeed = entry.pullingOver ? 0 : 12 + Math.sin(entry.car.id * 7) * 2;
      const ahead = carAhead(entry);
      if (ahead < 12) entry.targetSpeed = 0;
      else if (ahead < 22) entry.targetSpeed = Math.min(entry.targetSpeed, 5);
      if (playerCar) {
        const d = distance2D(car.pos.x, car.pos.z, playerCar.pos.x, playerCar.pos.z);
        const fwd = (playerCar.pos.x - car.pos.x) * Math.sin(car.heading)
          + (playerCar.pos.z - car.pos.z) * Math.cos(car.heading);
        if (d < 14 && fwd > 0) entry.targetSpeed = 0;
      }
      entry.speed += clamp(entry.targetSpeed - entry.speed, -18 * dt, 10 * dt);
      car.speed = entry.speed;
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      if (car.pos.x > 390) car.pos.x = -390;
      if (car.pos.x < -390) car.pos.x = 390;
      if (car.pos.z > 390) car.pos.z = -390;
      if (car.pos.z < -390) car.pos.z = 390;
      // Turn at an intersection sometimes.
      const nearX = ROAD_LINES.reduce((a, b) => (Math.abs(car.pos.x - b) < Math.abs(car.pos.x - a) ? b : a));
      const nearZ = ROAD_LINES.reduce((a, b) => (Math.abs(car.pos.z - b) < Math.abs(car.pos.z - a) ? b : a));
      if (Math.abs(car.pos.x - nearX) < 1.5 && Math.abs(car.pos.z - nearZ) < 1.5 && random() < dt * 0.25) {
        car.heading += random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        entry.horizontal = !entry.horizontal;
      }
    }
  }

  return { init, update, traffic, spawnTrafficCar };
}
