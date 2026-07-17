import { join } from 'path';

export const nxVersion = require(join('@nx/next', 'package.json')).version;

export const minSupportedNextVersion = '14.0.0';

export const next16Version = '~16.1.6';
export const next15Version = '~15.5.18';
export const next14Version = '~14.2.35';
export const nextVersion = next16Version;
export const eslintConfigNext16Version = '^16.1.6';
export const eslintConfigNext15Version = '^15.5.18';
// eslint-config-next 14 lacks ESLint v9 support, so Next.js 14 (being removed) uses 15.
export const eslintConfigNext14Version = '^15.5.18';
export const eslintConfigNextVersion = eslintConfigNext16Version;
export const sassVersion = '1.97.2';
export const tsLibVersion = '^2.3.0';
