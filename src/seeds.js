// 17 historical league sessions — 2025-26 season
// Seeded on first launch if mbowl_sessions_v1 is empty.

function makeGames(scores) {
  return scores.map((score, i) => ({
    game:   i + 1,
    score,
    ball:   null,
    frames: null,
    notes:  null,
  }));
}

export const SEED_SESSIONS = [
  { id: 1001, type: 'league', date: '2025-09-06', week: 1,  opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([155, 169, 156]), notes: null },
  { id: 1002, type: 'league', date: '2025-09-13', week: 2,  opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([138, 169, 181]), notes: null },
  { id: 1003, type: 'league', date: '2025-09-27', week: 4,  opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([176, 136, 166]), notes: null },
  { id: 1004, type: 'league', date: '2025-10-18', week: 7,  opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([160, 165, 148]), notes: null },
  { id: 1005, type: 'league', date: '2025-10-25', week: 8,  opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([253, 157, 181]), notes: null },
  { id: 1006, type: 'league', date: '2025-11-01', week: 9,  opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([143, 144, 143]), notes: null },
  { id: 1007, type: 'league', date: '2025-11-08', week: 10, opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([166, 161, 180]), notes: null },
  { id: 1008, type: 'league', date: '2025-11-15', week: 11, opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([168, 145, 190]), notes: null },
  { id: 1009, type: 'league', date: '2025-11-29', week: 13, opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([167, 149, 162]), notes: null },
  { id: 1010, type: 'league', date: '2025-12-06', week: 14, opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([173, 205, 242]), notes: null },
  { id: 1011, type: 'league', date: '2025-12-20', week: 16, opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([141, 198, 131]), notes: null },
  { id: 1012, type: 'league', date: '2025-12-27', week: 17, opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([122, 163, 183]), notes: null },
  { id: 1013, type: 'league', date: '2026-01-10', week: 19, opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([170, 157, 161]), notes: null },
  { id: 1014, type: 'league', date: '2026-01-17', week: 20, opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([163, 154, 160]), notes: null },
  { id: 1015, type: 'league', date: '2026-01-31', week: 22, opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([162, 190, 200]), notes: null },
  { id: 1016, type: 'league', date: '2026-02-07', week: 23, opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([199, 156, 201]), notes: null },
  { id: 1017, type: 'league', date: '2026-02-28', week: 26, opponent: null, name: null, format: null, pattern: null, madeCut: null, placement: null, games: makeGames([130, 186, 164]), notes: null },
];
