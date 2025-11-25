export const nxVersion = require('../../package.json').version;

// Nuxt versions
export const nuxtV4Version = '^4.0.0';
export const nuxtV3Version = '^3.10.0';
export const nuxtVersion = nuxtV4Version; // Default to v4

// @nuxt/kit versions (aligned with Nuxt)
export const nuxtKitV4Version = '^4.0.0';
export const nuxtKitV3Version = '^3.10.0';
export const nuxtKitVersion = nuxtKitV4Version;

// nuxt deps
export const h3Version = '^1.8.2';
export const nuxtDevtoolsVersion = '1.0.0';
export const nuxtUiTemplatesVersion = '^1.3.1';

// linting deps - version-aware for flat config vs legacy
export const nuxtEslintConfigVersion = '^1.10.0'; // For flat config (Nuxt v4+) - uses createConfigForNuxt
export const nuxtEslintConfigLegacyVersion = '~0.5.6'; // For legacy .eslintrc.json (Nuxt v3)
