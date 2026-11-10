// `npm run check` — one command that checks everything (Phase 26A.2).
//
//   1. TypeScript (npx tsc --noEmit)
//   2. leaves   — split detection + Makeable rule (real src/leaveUtils.js)
//   3. seasons  — gapless seasons + shared filter (real src/seasons.ts, sessionFilter.ts)
//   4. rules    — CLAUDE.md rules that a grep can enforce
//   5. stats    — Phase 24 harness on the 18 seeds (stats.tsx metric COPY; see its header)
//
// Exit code 0 = everything passed. CI (ci.yml) and the /ship skill run this.
// Flags: --skip-tsc (when a hook already ran it).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const skipTsc = process.argv.includes('--skip-tsc');
const NODE_FLAGS = ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--disable-warning=ExperimentalWarning'];

const steps = [];
if (!skipTsc) {
  const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  steps.push({
    name: 'typescript',
    cmd: process.execPath,
    args: existsSync(tsc) ? [tsc, '--noEmit', '-p', ROOT] : null,
  });
}
for (const name of ['leaves', 'seasons', 'rules']) {
  steps.push({
    name,
    cmd: process.execPath,
    args: [...NODE_FLAGS, '--import', './scripts/checks/register.mjs', `scripts/checks/${name}.check.mjs`],
  });
}
steps.push({
  name: 'stats (seeds)',
  cmd: process.execPath,
  args: [...NODE_FLAGS, 'scripts/phase24-verify.mjs', '--expect', '18,0,0', '--seeds'],
});

let failed = 0;
for (const step of steps) {
  console.log(`\n▶ ${step.name}`);
  if (!step.args) {
    console.log('  ✗ node_modules/typescript missing — run npm ci first');
    failed++;
    continue;
  }
  const res = spawnSync(step.cmd, step.args, { cwd: ROOT, stdio: 'inherit' });
  if (res.status !== 0) {
    failed++;
    console.log(`  ✗ ${step.name} FAILED (exit ${res.status})`);
  } else if (step.name === 'typescript') {
    console.log('  ✓ typescript: clean');
  }
}

console.log(`\n${failed === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failed} CHECK(S) FAILED`}`);
process.exitCode = failed === 0 ? 0 : 1;
