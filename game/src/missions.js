// missionsCatalog: fifteen story missions in three acts, starring Lena "Vex"
// Marlowe and her crew — Rico the wheelman, June the hacker, and Sal the
// fixer. Each mission is a list of steps the engine plays in order.
export const ACTS = [
  { id: 1, name: 'ACT I — SALT IN THE WOUND', summary: 'Vex comes home to Paloma Bay and takes back her streets.' },
  { id: 2, name: 'ACT II — HIGH TIDE', summary: 'The crew hits bigger scores. The Vultures hit back.' },
  { id: 3, name: 'ACT III — CRIMSON TIDE', summary: 'One last job to own the bay — or lose everything.' },
];

export const MISSIONS = [
  {
    id: 1, act: 1, title: 'Welcome Home', district: 'oldtown', reward: 400,
    briefing: 'RICO: "Vex! You made it. Get to the hideout — the Vultures took your old corner."',
    steps: [
      { type: 'goto', x: 24, z: 120, label: 'Reach the hideout in Old Town' },
      { type: 'talk', x: 80, z: 120, label: 'Meet Rico at the corner' },
    ],
  },
  {
    id: 2, act: 1, title: 'Hot Wheels', district: 'marina', reward: 800,
    briefing: 'RICO: "We need wheels. Jack that Sirocco by the marina and bring it to the garage."',
    steps: [
      { type: 'steal', x: 320, z: -160, label: 'Steal the Sirocco at Marina Bay' },
      { type: 'deliver', x: 240, z: -160, label: 'Deliver the car to Marina Garage' },
    ],
  },
  {
    id: 3, act: 1, title: 'Harbor Lights', district: 'docks', reward: 900,
    briefing: 'JUNE: "A package is waiting at the docks. Grab it — and keep it quiet."',
    steps: [
      { type: 'pickup', x: -320, z: -80, label: 'Pick up the package at Harbor Docks' },
      { type: 'deliver', x: 24, z: 120, label: 'Bring the package back to the hideout' },
    ],
  },
  {
    id: 4, act: 1, title: 'First Blood', district: 'docks', reward: 1200,
    briefing: 'SAL: "The Vultures are shaking down the dock workers. Clear them out."',
    steps: [
      { type: 'goto', x: -240, z: -80, label: 'Reach the container yard' },
      { type: 'kill', x: -240, z: -80, count: 4, label: 'Clear out the Vultures (0/4)' },
      { type: 'goto', x: 24, z: 120, label: 'Report back to the hideout' },
    ],
  },
  {
    id: 5, act: 1, title: 'Street Kings', district: 'neon', reward: 1500,
    briefing: 'RICO: "Midnight race on the Strip. Beat the Vulture wheelman and the streets are ours."',
    steps: [
      { type: 'goto', x: 0, z: 240, label: 'Reach the start line on Neon Strip' },
      { type: 'race', checkpoints: [[0, 240], [160, 240], [160, 80], [-160, 80], [-160, 240], [0, 240]], timeLimit: 150, label: 'Win the street race — 6 checkpoints' },
    ],
  },
  {
    id: 6, act: 2, title: 'The Fixer', district: 'oldtown', reward: 1400,
    briefing: 'JUNE: "Sal has a buyer. Tail his courier from Old Town — do not get spotted."',
    steps: [
      { type: 'goto', x: -80, z: 0, label: 'Find the courier in Old Town' },
      { type: 'tail', x: -80, z: 0, duration: 30, label: 'Tail the courier — stay 15–45 m back' },
      { type: 'goto', x: 120, z: 160, label: 'Follow him to the Coral Clinic drop' },
    ],
  },
  {
    id: 7, act: 2, title: 'Night Shift', district: 'docks', reward: 2200,
    briefing: 'SAL: "A Vulture van full of cash is parked at the docks. Take it. Quietly, then loudly."',
    steps: [
      { type: 'steal', x: -240, z: 80, label: 'Steal the Vulture van at the docks' },
      { type: 'kill', x: -240, z: 80, count: 3, label: 'Deal with the guards (0/3)' },
      { type: 'deliver', x: 24, z: 120, label: 'Drive the van to the hideout' },
    ],
  },
  {
    id: 8, act: 2, title: 'Crossfire', district: 'marina', reward: 2400,
    briefing: 'RICO: "Ambush at the marina! Hold the line until June cracks the gate."',
    steps: [
      { type: 'goto', x: 320, z: -160, label: 'Reach the marina ambush' },
      { type: 'survive', duration: 45, label: 'Survive the ambush — hold the marina' },
    ],
  },
  {
    id: 9, act: 2, title: 'Grand Prix Paloma', district: 'neon', reward: 3000,
    briefing: 'JUNE: "The big one. Eight checkpoints, the whole bay watching. Win it."',
    steps: [
      { type: 'goto', x: 0, z: 240, label: 'Reach the Grand Prix start line' },
      { type: 'race', checkpoints: [[0, 240], [240, 240], [240, -160], [-240, -160], [-240, 160], [80, 160], [80, -80], [0, 240]], timeLimit: 210, label: 'Win the Grand Prix — 8 checkpoints' },
    ],
  },
  {
    id: 10, act: 2, title: 'The Vault', district: 'hills', reward: 5000,
    briefing: 'SAL: "Coral Hills bank. In, out, gone before the chopper arrives. Three stars, minimum."',
    steps: [
      { type: 'goto', x: 240, z: 160, label: 'Reach the Coral Hills bank' },
      { type: 'kill', x: 240, z: 160, count: 5, label: 'Take the vault guards (0/5)' },
      { type: 'pickup', x: 240, z: 160, label: 'Grab the vault cash' },
      { type: 'escape', duration: 60, label: 'Escape the police — lose your wanted level' },
    ],
  },
  {
    id: 11, act: 3, title: 'Loose Ends', district: 'docks', reward: 3200,
    briefing: 'RICO: "They took June! She is at the docks. Get her out — no one gets left behind."',
    steps: [
      { type: 'goto', x: -320, z: 160, label: 'Reach the dock warehouse' },
      { type: 'kill', x: -320, z: 160, count: 6, label: 'Free June — clear the warehouse (0/6)' },
      { type: 'goto', x: 24, z: 120, label: 'Bring June back to the hideout' },
    ],
  },
  {
    id: 12, act: 3, title: 'Blockade Run', district: 'neon', reward: 3600,
    briefing: 'JUNE: "Every cop in the city is on the Strip. Punch through the roadblocks."',
    steps: [
      { type: 'goto', x: 0, z: 240, label: 'Reach Neon Strip' },
      { type: 'drive', x: -240, z: -160, label: 'Run the blockade — reach Marina Bay' },
      { type: 'escape', duration: 45, label: 'Lose the heat' },
    ],
  },
  {
    id: 13, act: 3, title: 'Harbor Siege', district: 'docks', reward: 4200,
    briefing: 'SAL: "The Vultures are taking the harbor tonight. Take it back — all of it."',
    steps: [
      { type: 'goto', x: -320, z: -80, label: 'Reach the harbor' },
      { type: 'survive', duration: 60, label: 'Hold the harbor against the siege' },
      { type: 'kill', x: -320, z: -80, count: 4, label: 'Finish the last Vultures (0/4)' },
    ],
  },
  {
    id: 14, act: 3, title: 'The Long Con', district: 'marina', reward: 4800,
    briefing: 'JUNE: "One last delivery — and it is a trap. Play along, then run."',
    steps: [
      { type: 'pickup', x: 240, z: -160, label: 'Pick up the "delivery" at the garage' },
      { type: 'deliver', x: -80, z: 0, label: 'Deliver it to Old Town' },
      { type: 'kill', x: -80, z: 0, count: 5, label: 'The trap springs — fight your way out (0/5)' },
      { type: 'escape', duration: 45, label: 'Escape the trap' },
    ],
  },
  {
    id: 15, act: 3, title: 'King of the Bay', district: 'neon', reward: 10000,
    briefing: 'RICO: "The Vulture boss himself, on the Strip, tonight. Race him, beat him, end this."',
    steps: [
      { type: 'goto', x: 0, z: 240, label: 'Reach the final start line' },
      { type: 'race', checkpoints: [[0, 240], [240, 240], [240, -240], [-240, -240], [-240, 240], [0, 240]], timeLimit: 180, label: 'Outrun the Vulture boss — 6 checkpoints' },
      { type: 'kill', x: 0, z: 240, count: 6, label: 'Finish the boss crew (0/6)' },
      { type: 'goto', x: -40, z: -340, label: 'Watch the sunrise on the beach — you own the bay' },
    ],
  },
];

export function getMission(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

export function missionsForAct(act) {
  return MISSIONS.filter((m) => m.act === act);
}

export function totalMissions() {
  return MISSIONS.length;
}
