// Registers ts-resolve.mjs. Use with: node --import ./scripts/checks/register.mjs <file>
import { register } from 'node:module';

register('./ts-resolve.mjs', import.meta.url);
