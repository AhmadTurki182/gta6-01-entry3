// economyManager: cash, district standing, and the shops of Paloma Bay.
// Standing rises when you finish work in a district and unlocks better
// payouts, cheaper gear, and the finale. Shops: Ironworks (weapons), the
// Marina garage (cars), and the Coral clinic (health + armor).
import { clamp } from './util.js';
import { DISTRICTS } from './city.js';

export const SHOPS = [
  { id: 'ironworks', name: 'Ironworks Guns', x: -40, z: 40, kind: 'weapons' },
  { id: 'garage', name: 'Marina Garage', x: 240, z: -160, kind: 'cars' },
  { id: 'clinic', name: 'Coral Clinic', x: 120, z: 160, kind: 'health' },
];

export const WEAPON_PRICES = { smg: 1200, shotgun: 900, rifle: 2400 };
export const AMMO_PRICES = { smg: 150, shotgun: 120, rifle: 200 };

export function createEconomyManager() {
  const state = {
    cash: 500,
    standing: {},
    ownedCars: ['Comet GT'],
    ownedWeapons: ['pistol'],
    respect: 0,
  };
  for (const d of DISTRICTS) state.standing[d.id] = 0;

  function addCash(amount) {
    state.cash = Math.max(0, state.cash + amount);
    return state.cash;
  }

  function addStanding(districtId, amount) {
    if (!(districtId in state.standing)) return 0;
    state.standing[districtId] = clamp(state.standing[districtId] + amount, 0, 100);
    state.respect = Math.round(
      Object.values(state.standing).reduce((a, b) => a + b, 0) / DISTRICTS.length,
    );
    return state.standing[districtId];
  }

  function payout(base, districtId) {
    const bonus = 1 + (state.standing[districtId] || 0) / 200;
    return Math.round(base * bonus);
  }

  function buyWeapon(id) {
    const price = WEAPON_PRICES[id];
    if (!price || state.ownedWeapons.includes(id)) return false;
    if (state.cash < price) return false;
    state.cash -= price;
    state.ownedWeapons.push(id);
    return true;
  }

  function buyAmmo(id) {
    const price = AMMO_PRICES[id];
    if (!price || !state.ownedWeapons.includes(id)) return false;
    if (state.cash < price) return false;
    state.cash -= price;
    return true;
  }

  function buyCar(name, price) {
    if (state.ownedCars.includes(name)) return false;
    if (state.cash < price) return false;
    state.cash -= price;
    state.ownedCars.push(name);
    return true;
  }

  function buyHealth() {
    if (state.cash < 150) return false;
    state.cash -= 150;
    return true;
  }

  function buyArmor() {
    if (state.cash < 400) return false;
    state.cash -= 400;
    return true;
  }

  return {
    state, addCash, addStanding, payout, buyWeapon, buyAmmo, buyCar, buyHealth, buyArmor,
    SHOPS, WEAPON_PRICES, AMMO_PRICES,
  };
}
