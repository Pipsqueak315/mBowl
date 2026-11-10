// Node resolve hook for the checks (Phase 26A.2).
//
// Node 22 runs .ts files natively (type stripping), but the app imports
// relative modules WITHOUT an extension ('./seasons'), which Node's ESM
// resolver rejects. This hook retries an unresolved relative import with
// .ts / .js appended, so checks can import the real app source — no copies
// that can drift. Registered by run-all.mjs; checks can also be run alone with
//   node --import ./scripts/checks/register.mjs scripts/checks/<name>.check.mjs

const EXTS = ['.ts', '.js'];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (!relative || err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    for (const ext of EXTS) {
      try {
        return await nextResolve(specifier + ext, context);
      } catch {
        // try the next extension
      }
    }
    throw err;
  }
}
