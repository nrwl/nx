#### Spread `eslint-config-next` in Next.js flat ESLint configs

Replaces the Next.js entries Nx generated in flat ESLint configs with a spread of `eslint-config-next/core-web-vitals`. eslint-config-next 16.4 is the first release that patches its bundled plugins for ESLint 10. The migration handles two generated shapes:

- Next.js 16 apps registered the `@next/next` plugin without the `eslint-config-next` rule set.
- Next.js 15 apps and configs converted from `.eslintrc` files extended `next` and `next/core-web-vitals` through `FlatCompat`. That fails on eslint-config-next 16, which ships only flat configs.

The migration also removes the `@next/eslint-plugin-next`, `FlatCompat` and `fixupConfigRules` setup once no other entry uses it.

When the migration spreads eslint-config-next in an ESM config, it also names the exported array (`const eslintConfig = [...]; export default eslintConfig;`). eslint-config-next turns on `import/no-anonymous-default-export`, which reports `export default [...]`. If the config already uses the name `eslintConfig`, the export takes the first unused name of `eslintConfig2`, `eslintConfig3` and so on.

The config, or a config at the workspace root, may register the `react`, `react-hooks`, `import` or `jsx-a11y` plugin, directly or through a local module it loads by a relative path. eslint-config-next registers those plugins too, and ESLint fails when two configs register different copies of one plugin. In that case the migration replaces the `@next/next` registration with the `core-web-vitals` config of `@next/eslint-plugin-next`, which registers only the Next.js plugin. Files that the other config does not lint with those plugins get no React, React Hooks, jsx-a11y or import rules. Rules and directive comments that name a `react/`, `jsx-a11y/` or `import/` rule then fail in that config and the files it lints, unless another config registers the plugin. The migration lists each config it changes this way.

The migration finds such a plugin when one of those files loads the plugin's package or a file inside it, names a config that registers the plugin (such as `flat/react`), or has a `plugins` object with the plugin's name. It checks each local module as a whole, except for type-only imports. A module that registers one of those plugins only in a config the app does not use still counts. To get the eslint-config-next rules in that case, replace the `core-web-vitals` config with the `eslint-config-next/core-web-vitals` spread by hand. The migration misses any other registration, such as a plugin that an npm config package registers or a module loaded by a computed path. It then spreads eslint-config-next, and ESLint fails with `Cannot redefine plugin` until you replace the spread with the `core-web-vitals` config of `@next/eslint-plugin-next` by hand.

It leaves a config unchanged and lists it, with the steps to finish by hand, when:

- the config already imports `eslint-config-next`.
- the config, or a config at the workspace root, registers one of those plugins and the config extends `next` through `FlatCompat`. The `next` configs also registered `react`, `import` and `jsx-a11y`, and rules in the config may reference them.
- the Next.js entries differ from the ones Nx generates.

#### Sample code changes

##### Before

```js title="apps/my-app/eslint.config.mjs"
import nextEslintPluginNext from '@next/eslint-plugin-next';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  { plugins: { '@next/next': nextEslintPluginNext } },
  ...nx.configs['flat/react-typescript'],
  ...baseConfig,
  {
    ignores: ['.next/**/*'],
  },
];
```

##### After

```js title="apps/my-app/eslint.config.mjs"
import nextVitals from 'eslint-config-next/core-web-vitals';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

const eslintConfig = [
  ...nextVitals,
  ...nx.configs['flat/react-typescript'],
  ...baseConfig,
  {
    ignores: ['.next/**/*'],
  },
];

export default eslintConfig;
```
