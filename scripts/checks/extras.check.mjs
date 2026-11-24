// Phase 31 checks against the real src helpers. Hand-built data only.
import { framesParam } from '../../src/framesParam.ts';
import { check, eq, done } from './lib.mjs';

// --- N23: frames route param survives URL decoding -------------------------
{
  const frames = [
    { throws: ['X'], note: 'a %22 b + c 100% \\%41', throwNotes: { 0: '50%+' }, pinsStanding: null },
    { throws: ['7', '/'], note: null },
  ];
  const p = framesParam(frames);
  check(!p.includes('%') && !p.includes('+'), 'no raw % or + left in the param');
  eq(JSON.stringify(JSON.parse(p)), JSON.stringify(frames), 'parses back to the same frames');
  eq(decodeURIComponent(p), p, 'one decode is a no-op');
  eq(decodeURIComponent(decodeURIComponent(p)), p, 'two decodes are a no-op');
}

done('extras');
