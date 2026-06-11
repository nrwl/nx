import { join } from 'path';

export const nxVersion = require(join('@nx/nuxt', 'package.json')).version;

// Lowest Nuxt version the plugin supports. Nuxt 2 is EOL (2024-06-30). The only
// runtime Nuxt API the plugin uses is `@nuxt/kit`'s `loadNuxtConfig` (reading
// `buildDir`), which resolves the workspace's own `@nuxt/kit` (an optional
// peer) and is present since 3.0.0; `@nuxt/schema` is a type-only import. So the
// effective floor is the v3 major, 3.0.0.
export const minSupportedNuxtVersion = '3.0.0';

// Nuxt versions
export const nuxtV4Version = '^4.0.0';
export const nuxtV3Version = '^3.21.1';
export const nuxtVersion = nuxtV4Version; // Default to v4

// @nuxt/kit versions (aligned with Nuxt)
export const nuxtKitV4Version = '^4.0.0';
export const nuxtKitV3Version = '^3.21.1';
export const nuxtKitVersion = nuxtKitV4Version;

// @nuxt/schema versions (aligned with Nuxt)
export const nuxtSchemaV4Version = '^4.0.0';
export const nuxtSchemaV3Version = '^3.21.1';
export const nuxtSchemaVersion = nuxtSchemaV4Version;

// nuxt deps
export const h3Version = '^1.8.2';
export const nuxtDevtoolsV4Version = '^3.0.0';
export const nuxtDevtoolsV3Version = '^3.1.1';
export const nuxtDevtoolsVersion = nuxtDevtoolsV4Version;
export const nuxtUiTemplatesVersion = '^1.3.1';

// linting deps - version-aware for flat config vs legacy
export const nuxtEslintConfigVersion = '^1.10.0'; // For flat config (Nuxt v4+) - uses createConfigForNuxt
export const nuxtEslintConfigLegacyVersion = '~0.5.6'; // For legacy .eslintrc.json (Nuxt v3)
