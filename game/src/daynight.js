// dayNightCycle: a full 24-hour sun that drives the sky, fog, and street
// lights. Golden hour at 17:30, neon night after 20:00, dawn at 06:00.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';

const SKY_DAY = new THREE.Color(0x87b5d9);
const SKY_GOLDEN = new THREE.Color(0xff9a4a);
const SKY_NIGHT = new THREE.Color(0x0d1526);
const SKY_DAWN = new THREE.Color(0xe8a07a);
const FOG_DAY = new THREE.Color(0x9ab8c9);
const FOG_NIGHT = new THREE.Color(0x0d1526);

export function createDayNightCycle(scene, streetLights, neonSigns) {
  const sun = new THREE.DirectionalLight(0xffe0b0, 2.2);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x5a4a3a, 0.9);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8aa5ff, 0.0);
  moon.position.set(-100, 160, -80);
  scene.add(moon);
  scene.fog = new THREE.Fog(0x9ab8c9, 180, 900);

  let time = 17.5; // golden hour at the start

  function skyColorAt(t) {
    if (t >= 6 && t < 8) return SKY_DAWN.clone().lerp(SKY_DAY, (t - 6) / 2);
    if (t >= 8 && t < 16.5) return SKY_DAY.clone();
    if (t >= 16.5 && t < 19) return SKY_DAY.clone().lerp(SKY_GOLDEN, (t - 16.5) / 2.5);
    if (t >= 19 && t < 20.5) return SKY_GOLDEN.clone().lerp(SKY_NIGHT, (t - 19) / 1.5);
    if (t >= 20.5 || t < 5) return SKY_NIGHT.clone();
    return SKY_NIGHT.clone().lerp(SKY_DAWN, (t - 5) / 1);
  }

  function update(dt, timeScale = 1) {
    time = (time + (dt * timeScale) / 3600) % 24;
    const sunAngle = ((time - 6) / 12) * Math.PI;
    const sunUp = Math.sin(sunAngle);
    sun.position.set(Math.cos(sunAngle) * 300, Math.max(20, sunUp * 260), 120);
    sun.intensity = clamp(sunUp * 2.4, 0.05, 2.4);
    moon.intensity = sunUp > 0 ? 0 : 0.6;
    hemi.intensity = sunUp > 0 ? 0.9 : 0.55;
    const sky = skyColorAt(time);
    scene.background = sky;
    scene.fog.color.copy(sky).lerp(time >= 20.5 || time < 5 ? FOG_NIGHT : FOG_DAY, 0.4);
    const night = time >= 20 || time < 5.5;
    for (const bulb of streetLights) {
      bulb.material.color.setHex(night ? 0xffe9a8 : 0x555555);
    }
    for (const sign of neonSigns) {
      sign.material.color.multiplyScalar(1); // emissive signs stay bright
    }
    return { time, night, sunUp };
  }

  return {
    update,
    get time() { return time; },
    set time(t) { time = t % 24; },
    isNight() { return time >= 20 || time < 5.5; },
  };
}
