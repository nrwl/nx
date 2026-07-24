import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const nxVersion: string = require('@nx/oxlint/package.json').version;

export const minSupportedOxlintVersion = '1.0.0';
export const oxlintVersion = '^1.75.0';
