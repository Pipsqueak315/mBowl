// Static project-rule checks (Phase 26A.2). Cheap greps that enforce rules
// from CLAUDE.md that are easy to break and hard to spot in review.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, done } from './lib.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const SOURCE_DIRS = ['app', 'components', 'src'];
const EXT = /\.(ts|tsx|js|jsx)$/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}
const files = SOURCE_DIRS.flatMap(d => walk(join(ROOT, d)));
const rel = p => relative(ROOT, p).split('\\').join('/');

for (const file of files) {
  const r = rel(file);
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');

  // 1. Storage keys only via KEYS.X — no raw 'mbowl_…' strings outside storage.ts.
  if (r !== 'src/storage.ts') {
    lines.forEach((line, i) => {
      if (/['"`]mbowl_[a-z0-9_]+['"`]/.test(line)) {
        check(false, `raw storage key in ${r}:${i + 1}`, 'use KEYS.X from src/storage.ts');
      }
    });
  }

  // 2. SF Pro only — no custom font loading.
  check(!/useFonts\s*\(|Font\.loadAsync|@expo-google-fonts/.test(src), `no custom fonts in ${r}`);

  // 3. Dark mode only — no light-mode branches.
  check(!/useColorScheme\s*\(\s*\)\s*===?\s*['"]light['"]/.test(src), `no light-mode branch in ${r}`);

  // 4. AsyncStorage is the only storage.
  check(!/expo-sqlite|react-native-mmkv|realm/.test(src), `AsyncStorage only in ${r}`);
}

// 5. Exactly four tabs. A tab is a screen file in app/(tabs)/ or, since the
// native-tabs switch (27.4), a folder holding the tab's own stack + index.tsx.
const TABS_DIR = join(ROOT, 'app', '(tabs)');
const tabs = readdirSync(TABS_DIR).filter(n =>
  statSync(join(TABS_DIR, n)).isDirectory()
    ? readdirSync(join(TABS_DIR, n)).includes('index.tsx')
    : /\.tsx$/.test(n) && n !== '_layout.tsx'
);
check(tabs.length === 4, 'exactly 4 tab screens', `found ${tabs.join(', ')}`);

// 6. Bundle id never changes.
const appJson = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'));
check(appJson.expo?.ios?.bundleIdentifier === 'com.marcus.mbowl', 'bundle id is com.marcus.mbowl');

// 7. The real backup never gets committed (gitignore still covers it).
const gi = readFileSync(join(ROOT, '.gitignore'), 'utf8');
check(gi.includes('mBowl-backup.json') && gi.includes('docs/phase24-data.json'), 'real-data files are gitignored');

done('rules');
