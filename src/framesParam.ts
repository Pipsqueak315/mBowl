// N23 (Phase 31A): Log Frames gets a game's frames as a JSON route param, and
// Expo Router URL-decodes params on the way in -- a note holding a literal
// "%22"-style sequence was decoded into a quote and broke JSON.parse (Log
// Frames opened empty). JSON lets any character be written as a \u escape, so
// '%' (and '+', which some decoders turn into a space) never appear raw:
// decoding becomes a no-op and JSON.parse gives back the exact text.
export function framesParam(frames: unknown): string {
  return JSON.stringify(frames).replace(/%/g, '\\u0025').replace(/\+/g, '\\u002b');
}
