// `npm run ship:ota` — the only hand-run path that sends an update to the phone
// (Phase 26A.3/26A.6). The guard-shell hook blocks raw `eas update`.
//
// Refuses unless: on master, working tree clean, in sync with origin, and every
// check passes. Then publishes to the production channel with the last commit
// subject as the update message. Needs `eas login` done once on this machine
// (the GitHub workflow ota.yml uses the EXPO_TOKEN secret instead).
import { spawnSync } from 'node:child_process';

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', ...opts });
}
function git(...args) {
  return (run('git', args).stdout ?? '').trim();
}
function stop(msg) {
  console.error(`✗ ship:ota stopped — ${msg}`);
  process.exit(1);
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branch !== 'master') stop(`on branch "${branch}". Merge to master first.`);
if (git('status', '--porcelain')) stop('uncommitted changes. Commit or stash them first.');
run('git', ['fetch', 'origin', 'master']);
if (git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/master')) {
  stop('local master differs from origin/master. Push or pull first, so the phone gets exactly what GitHub has.');
}

const checks = run(process.execPath, ['scripts/checks/run-all.mjs'], { stdio: 'inherit' });
if (checks.status !== 0) stop('checks failed. Nothing was shipped.');

const message = git('log', '-1', '--pretty=%s');
console.log(`\n▶ eas update --branch production --message "${message}"`);
const eas = run('npx', ['eas-cli', 'update', '--branch', 'production', '--message', message, '--non-interactive'], {
  stdio: 'inherit',
});
process.exit(eas.status ?? 1);
