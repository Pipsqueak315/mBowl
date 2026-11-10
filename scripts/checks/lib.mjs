// Tiny assertion helpers shared by the *.check.mjs files (Phase 26A.2).
// Each check exits non-zero if any assertion failed, so run-all.mjs and CI
// can tell pass from fail without parsing output.

let failures = 0;
let passes = 0;

export function check(ok, label, detail = '') {
  if (ok) {
    passes++;
  } else {
    failures++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

export function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(a === e, label, `expected ${e}, got ${a}`);
}

export function done(name) {
  console.log(`  ${failures === 0 ? '✓' : '✗'} ${name}: ${passes} passed, ${failures} failed`);
  process.exitCode = failures === 0 ? 0 : 1;
}

// Pin helper: standing pin numbers (1–10) → length-10 pinsStanding array.
export function pins(...standing) {
  const arr = Array(10).fill(false);
  for (const p of standing) arr[p - 1] = true;
  return arr;
}
