// Initial 9-ball roster — sorted weakest to strongest per spec.
// Strength: 1–5 integer matching Arsenal dots rating.

export const INITIAL_BALLS = [
  { id: 'spare-ball',       name: 'Spare Ball',                    short: 'Spare',      strength: 1, active: true },
  { id: 'phaze2-pearl',     name: 'Phaze 2 Pearl',                 short: 'P2 Pearl',   strength: 2, active: true },
  { id: 'phaze5',           name: 'Phaze 5',                       short: 'Phaze 5',    strength: 2, active: true },
  { id: 'physix-blackout-1',name: 'Physix Blackout #1',            short: 'Physix #1',  strength: 3, active: true },
  { id: 'summit',           name: 'Summit',                        short: 'Summit',     strength: 3, active: true },
  { id: 'phaze2-solid',     name: 'Phaze 2 Solid',                 short: 'P2 Solid',   strength: 3, active: true },
  { id: 'physix-blackout-2',name: 'Physix Blackout #2 (Pin Down)', short: 'Physix #2',  strength: 4, active: true },
  { id: 'primal-rage',      name: 'Primal Rage Evolution',         short: 'Primal Rage',strength: 4, active: true },
  { id: 've-blackout',      name: 'VE Blackout',                   short: 'VE Blackout',strength: 5, active: true },
];
