#### Spread `eslint-config-next` in Next.js flat ESLint configs

Replaces the Next.js entries Nx generated in flat ESLint configs with a spread of `eslint-config-next/core-web-vitals`. eslint-config-next 16.4 is the first release that patches its bundled plugins for ESLint 10. The migration handles two generated shapes:

- Next.js 16 apps registered the `@next/next` plugin without the `eslint-config-next` rule set.
- Next.js 15 apps and configs converted from `.eslintrc` files extended `next` and `next/core-web-vitals` through `FlatCompat`. That fails on eslint-config-next 16, which ships only flat configs.

The migration also removes the `@next/eslint-plugin-next`, `FlatCompat` and `fixupConfigRules` setup once no other entry uses it.

An ESM config also gets a named export (`const eslintConfig = [...]; export default eslintConfig;`). eslint-config-next turns on `import/no-anonymous-default-export`, which reports `export default [...]`. A config that already uses the name `eslintConfig` keeps its unnamed export.

It leaves a config unchanged and lists it, with the steps to finish by hand, when:

- the config already imports `eslint-config-next`.
- the config, or a config at the workspace root, registers the `react`, `react-hooks`, `import` or `jsx-a11y` plugin. eslint-config-next registers those plugins too, and ESLint fails when two configs register different copies of one plugin.
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
