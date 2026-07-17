import { join } from 'path';

export const nxVersion = require(join('@nx/angular', 'package.json')).version;

export const angularVersion = '~22.0.4';
export const angularDevkitVersion = '~22.0.4';
export const ngPackagrVersion = '~22.0.0';
export const ngrxVersion = '^21.0.0';
export const rxjsVersion = '~7.8.0';
export const zoneJsVersion = '~0.16.2';
export const tsLibVersion = '^2.3.0';

export const corsVersion = '~2.8.5';
export const typesCorsVersion = '~2.8.5';
export const expressVersion = '^4.21.2';
export const typesExpressVersion = '^4.17.21';
export const browserSyncVersion = '^3.0.0';
export const moduleFederationNodeVersion = '^2.7.21';
export const moduleFederationEnhancedVersion = '^2.1.0';
export const webpackMergeVersion = '^5.8.0';

export const angularEslintVersion = '^22.0.0';
export const typescriptEslintVersion = '^8.40.0';
export const postcssVersion = '^8.4.5';
export const postcssUrlVersion = '~10.1.3';
export const autoprefixerVersion = '^10.4.0';
export const tsNodeVersion = '10.9.1';
export const lessVersion = '^4.3.0';

export const jestPresetAngularVersion = '~17.0.0';
export const typesNodeVersion = '^22.0.0';
export const jasmineMarblesVersion = '^0.9.2';

export const vitestVersion = '^4.0.8';
export const jsdomVersion = '^27.1.0';
// `@analogjs/vite-plugin-angular` (vitest-analog path) registers an
// `angularVitestPlugin` whose `transform` hook downlevels `@angular/*`
// fesm2022 modules via `vite.transformWithOxc({ target: 'es2016', … })`
// so Zone.js `fakeAsync` can intercept async/await. The lowered code
// emits external `@oxc-project/runtime/helpers/*` imports (oxc default
// `HelperMode = 'Runtime'`). Nothing upstream declares the runtime, so
// we add it explicitly to user projects.
export const oxcProjectRuntimeVersion = '^0.115.0';

export const jsoncEslintParserVersion = '^2.1.0';
