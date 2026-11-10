// PostToolUse hook (Phase 26A.3): after Claude edits a .ts/.tsx file, run the
// TypeScript check. If it fails, exit 2 so the errors go straight back to
// Claude and get fixed in the same turn — instead of being found at ship time.
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const file = String(input?.tool_input?.file_path ?? '');
if (!/\.(ts|tsx)$/.test(file)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
if (!existsSync(tsc)) process.exit(0); // deps not installed — nothing to check with

const res = spawnSync(process.execPath, [tsc, '--noEmit', '-p', root], { cwd: root, encoding: 'utf8' });
if (res.status === 0) process.exit(0);

const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.split('\n').filter(Boolean);
process.stderr.write(
  `TypeScript check failed after editing ${file} (${out.length} line(s)):\n${out.slice(0, 30).join('\n')}\n`,
);
process.exit(2);
