// effectsManager: muzzle flashes, tracers, explosions, skid marks, and
// floating damage/cash popups — all pooled so the frame rate stays steady.
import * as THREE from 'three';

export function createEffectsManager(scene) {
  const tracers = [];
  const particles = [];
  const flashes = [];
  const popups = [];

  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  const particleGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);

  function spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, tracerMat);
    scene.add(line);
    tracers.push({ line, life: 0.09 });
  }

  function spawnBurst(pos, color, count, speed, up = 4) {
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(particleGeo, mat);
      mesh.position.copy(pos);
      scene.add(mesh);
      particles.push({
        mesh,
        life: 0.5 + Math.random() * 0.5,
        vx: (Math.random() - 0.5) * speed,
        vy: Math.random() * up,
        vz: (Math.random() - 0.5) * speed,
      });
    }
  }

  return {
    muzzleFlash(pos) {
      const light = new THREE.PointLight(0xffc46a, 24, 14, 2);
      light.position.copy(pos);
      scene.add(light);
      flashes.push({ light, life: 0.07 });
      spawnBurst(pos, 0xffc46a, 4, 3, 2);
    },
    tracer(from, to) { spawnTracer(from, to); },
    blood(pos) { spawnBurst(pos, 0xc22a1e, 8, 4, 3); },
    explosion(pos) {
      const light = new THREE.PointLight(0xff7a1e, 90, 40, 1.5);
      light.position.set(pos.x, pos.y + 2, pos.z);
      scene.add(light);
      flashes.push({ light, life: 0.5 });
      spawnBurst(pos, 0xff7a1e, 26, 14, 10);
      spawnBurst(pos, 0x333333, 14, 8, 12);
    },
    sparks(pos) { spawnBurst(pos, 0xffe9a8, 10, 6, 4); },
    skidMark(pos) {
      const mark = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 2.2),
        new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55 }),
      );
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(pos.x, 0.13, pos.z);
      scene.add(mark);
      popups.push({ mesh: mark, life: 6, fade: true });
    },
    popup(text, pos, color = '#ffd94a') {
      popups.push({ text, pos: pos.clone(), life: 1.4, color });
    },
    update(dt) {
      for (let i = tracers.length - 1; i >= 0; i -= 1) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) {
          scene.remove(tracers[i].line);
          tracers[i].line.geometry.dispose();
          tracers.splice(i, 1);
        }
      }
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        p.vy -= 14 * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.rotation.x += dt * 6;
        if (p.life <= 0 || p.mesh.position.y < 0) {
          scene.remove(p.mesh);
          particles.splice(i, 1);
        }
      }
      for (let i = flashes.length - 1; i >= 0; i -= 1) {
        flashes[i].life -= dt;
        if (flashes[i].life <= 0) {
          scene.remove(flashes[i].light);
          flashes.splice(i, 1);
        }
      }
      for (let i = popups.length - 1; i >= 0; i -= 1) {
        const p = popups[i];
        p.life -= dt;
        if (p.life <= 0) {
          if (p.mesh) scene.remove(p.mesh);
          popups.splice(i, 1);
        }
      }
    },
    popups() { return popups.filter((p) => p.text); },
  };
}
