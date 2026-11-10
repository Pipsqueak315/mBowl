// PreToolUse hook (Phase 26A.3): rules Claude can't break, not just rules it
// tries to follow. Reads the tool call as JSON on stdin; exit 2 blocks the call
// and sends the stderr message back to Claude.
//
//   • `eas update` typed by hand → blocked. Updates go out through the checked
//     path only: `npm run ship:ota` (runs every check first) or ota.yml on GitHub.
//   • On Windows: `&&` and heredocs (`<<`) → blocked. PowerShell doesn't support
//     them on Marcus's machine (CLAUDE.md "Windows Machine Constraints").
import { readFileSync } from 'node:fs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0); // unreadable input → don't block
}
const command = String(input?.tool_input?.command ?? '');

function block(msg) {
  process.stderr.write(`Blocked by .claude/hooks/guard-shell.mjs: ${msg}\n`);
  process.exit(2);
}

if (/\beas(-cli)?\s+update\b/.test(command)) {
  block('do not run `eas update` directly. Ship with `npm run ship:ota` (runs npm run check first) or the ota.yml workflow on GitHub.');
}

if (process.platform === 'win32') {
  if (command.includes('&&')) {
    block('PowerShell on this machine does not support `&&`. Run the commands one at a time.');
  }
  if (/<<-?\s*['"]?\w+/.test(command)) {
    block('heredocs do not work on this machine. Write a JS file and run it with `node`.');
  }
}

process.exit(0);
