// hudManager: the whole interface — wanted stars, health and armor bars,
// cash, clock and district, mission objective card, speedometer, minimap,
// toasts, and the radio ticker. The minimap is a live top-down canvas.
import { formatCash, formatClock, clamp } from './util.js';

export function createHudManager(document) {
  const root = document.getElementById('hud');
  const starsEl = document.getElementById('wanted');
  const cashEl = document.getElementById('cash');
  const healthFill = document.getElementById('health-fill');
  const armorFill = document.getElementById('armor-fill');
  const clockEl = document.getElementById('clock');
  const districtEl = document.getElementById('district');
  const standingEl = document.getElementById('standing');
  const objectiveEl = document.getElementById('objective');
  const speedEl = document.getElementById('speed');
  const toastEl = document.getElementById('toast');
  const radioEl = document.getElementById('radio');
  const crosshairEl = document.getElementById('crosshair');
  const minimap = document.getElementById('minimap');
  const mapCtx = minimap.getContext('2d');
  const popupLayer = document.getElementById('popups');
  let toastTimer = null;

  function setWanted(level, searching) {
    let stars = '';
    for (let i = 0; i < 5; i += 1) {
      stars += i < level ? '★' : '☆';
    }
    starsEl.textContent = stars;
    starsEl.className = 'wanted' + (level > 0 ? ' hot' : '') + (searching ? ' searching' : '');
    starsEl.title = searching ? 'SEARCH — break line of sight!' : 'Wanted level ' + level;
  }

  function setVitals(health, armor) {
    healthFill.style.width = clamp(health, 0, 100) + '%';
    armorFill.style.width = clamp(armor, 0, 100) + '%';
    healthFill.className = 'fill' + (health < 30 ? ' low' : '');
  }

  function setCash(cash) {
    cashEl.textContent = formatCash(cash);
  }

  function setClock(time, districtName, standing) {
    clockEl.textContent = formatClock(time);
    districtEl.textContent = districtName;
    standingEl.textContent = 'Respect ' + standing + ' — ' + districtName + ' standing ' + standing + '%';
  }

  function setObjective(text, missionTitle) {
    if (!text) {
      objectiveEl.innerHTML = '<b>Free roam</b><span>Press M for missions · B for shops · Q radio</span>';
      return;
    }
    objectiveEl.innerHTML = '<b>' + missionTitle + '</b><span>' + text + '</span>';
  }

  function setSpeed(kmh, inCar) {
    if (!inCar) { speedEl.style.display = 'none'; return; }
    speedEl.style.display = 'block';
    speedEl.innerHTML = '<b>' + Math.round(kmh) + '</b><span>km/h</span>';
  }

  function toast(text, ms = 3200) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  function setRadio(name) {
    radioEl.textContent = '♪ ' + name;
  }

  function setCrosshair(visible) {
    crosshairEl.style.display = visible ? 'block' : 'none';
  }

  function setWeapon(name, ammo) {
    const el = document.getElementById('weapon');
    el.textContent = name + (ammo === Infinity ? ' ∞' : ' · ' + ammo);
  }

  // Minimap: districts as coloured blocks, roads as lines, the player as a
  // white wedge, cops as flashing blue/red dots, the objective as a yellow diamond.
  function drawMinimap(world, playerPos, playerHeading, objective, cops, trafficCars) {
    const size = minimap.width;
    const scale = size / 840;
    const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
    mapCtx.fillStyle = '#101418';
    mapCtx.fillRect(0, 0, size, size);
    for (const d of world.districts) {
      const [x0, y0] = toMap(d.x0, d.z0);
      const [x1, y1] = toMap(d.x1, d.z1);
      mapCtx.fillStyle = d.color + '55';
      mapCtx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    mapCtx.fillStyle = '#1d6f8e';
    mapCtx.fillRect(0, 0, size, (size / 840) * 40);
    mapCtx.strokeStyle = '#3a3f45';
    mapCtx.lineWidth = 2;
    for (const line of world.roadLines) {
      const [ax] = toMap(line, 0);
      mapCtx.beginPath(); mapCtx.moveTo(ax, 0); mapCtx.lineTo(ax, size); mapCtx.stroke();
      const [, ay] = toMap(0, line);
      mapCtx.beginPath(); mapCtx.moveTo(0, ay); mapCtx.lineTo(size, ay); mapCtx.stroke();
    }
    for (const car of trafficCars) {
      const [x, y] = toMap(car.pos.x, car.pos.z);
      mapCtx.fillStyle = '#9aa5ad';
      mapCtx.fillRect(x - 2, y - 2, 4, 4);
    }
    for (const cop of cops) {
      const [x, y] = toMap(cop.pos.x, cop.pos.z);
      mapCtx.fillStyle = Math.floor(performance.now() / 300) % 2 ? '#ff4444' : '#4488ff';
      mapCtx.beginPath(); mapCtx.arc(x, y, 4, 0, Math.PI * 2); mapCtx.fill();
    }
    if (objective) {
      const [x, y] = toMap(objective.x, objective.z);
      const pulse = 5 + Math.sin(performance.now() / 250) * 2;
      mapCtx.fillStyle = '#ffd94a';
      mapCtx.beginPath();
      mapCtx.moveTo(x, y - pulse); mapCtx.lineTo(x + pulse, y);
      mapCtx.lineTo(x, y + pulse); mapCtx.lineTo(x - pulse, y);
      mapCtx.closePath(); mapCtx.fill();
    }
    const [px, py] = toMap(playerPos.x, playerPos.z);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(Math.PI - playerHeading);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -8); mapCtx.lineTo(5, 6); mapCtx.lineTo(-5, 6);
    mapCtx.closePath(); mapCtx.fill();
    mapCtx.restore();
  }

  function showPopup(text, color) {
    const el = document.createElement('div');
    el.className = 'popup';
    el.textContent = text;
    el.style.color = color || '#ffd94a';
    el.style.left = (30 + Math.random() * 40) + '%';
    popupLayer.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  return {
    root, setWanted, setVitals, setCash, setClock, setObjective, setSpeed,
    toast, setRadio, setCrosshair, setWeapon, drawMinimap, showPopup,
  };
}
