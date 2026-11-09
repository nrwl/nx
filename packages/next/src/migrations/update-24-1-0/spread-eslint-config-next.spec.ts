import { formatFiles, type Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './spread-eslint-config-next';

const rootConfig = `import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
];
`;

describe('spread-eslint-config-next', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = { ...json.dependencies, next: '^16.0.0' };
      json.devDependencies = {
        ...json.devDependencies,
        eslint: '^10.0.0',
        'eslint-config-next': '^16.4.0',
      };
      return json;
    });
    tree.write('eslint.config.mjs', rootConfig);
  });

  it('spreads eslint-config-next in place of the generated @next/next plugin registration', async () => {
    tree.write(
      'apps/web/eslint.config.mjs',
      `import nextEslintPluginNext from '@next/eslint-plugin-next';
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
`
    );
    const reactAppConfig = `import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [...nx.configs['flat/react'], ...baseConfig];
`;
    tree.write('apps/react-app/eslint.config.mjs', reactAppConfig);

    const result = await migration(tree);

    const migrated = tree.read('apps/web/eslint.config.mjs', 'utf-8');
    expect(migrated).toMatchInlineSnapshot(`
      "import nextVitals from 'eslint-config-next/core-web-vitals';
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
      "
    `);
    expect(tree.read('apps/react-app/eslint.config.mjs', 'utf-8')).toBe(
      reactAppConfig
    );
    expect(result).toEqual({ skipAgentic: true });

    expect(await migration(tree)).toEqual({ skipAgentic: true });
    expect(tree.read('apps/web/eslint.config.mjs', 'utf-8')).toBe(migrated);
  });

  it('spreads eslint-config-next in a config exported through a const', async () => {
    tree.write(
      'apps/web/eslint.config.mjs',
      `import nextEslintPluginNext from '@next/eslint-plugin-next';
import baseConfig from '../../eslint.config.mjs';

const eslintConfig = [
  { plugins: { '@next/next': nextEslintPluginNext } },
  ...baseConfig,
];

export default eslintConfig;
`
    );

    await migration(tree);

    expect(tree.read('apps/web/eslint.config.mjs', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import nextVitals from 'eslint-config-next/core-web-vitals';
      import baseConfig from '../../eslint.config.mjs';

      const eslintConfig = [...nextVitals, ...baseConfig];

      export default eslintConfig;
      "
    `);
  });

  it('names the export with the first unused eslintConfig<N> when the config already uses eslintConfig', async () => {
    tree.write(
      'apps/web/eslint.config.mjs',
      `import nextEslintPluginNext from '@next/eslint-plugin-next';
import eslintConfig from '../../eslint.config.mjs';
import eslintConfig2 from './eslint.shared.mjs';

export default [
  { plugins: { '@next/next': nextEslintPluginNext } },
  ...eslintConfig,
  ...eslintConfig2,
];
`
    );

    await migration(tree);

    expect(tree.read('apps/web/eslint.config.mjs', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import nextVitals from 'eslint-config-next/core-web-vitals';
      import eslintConfig from '../../eslint.config.mjs';
      import eslintConfig2 from './eslint.shared.mjs';

      const eslintConfig3 = [...nextVitals, ...eslintConfig, ...eslintConfig2];

      export default eslintConfig3;
      "
    `);
  });

  it('spreads eslint-config-next in place of the generated FlatCompat entries and removes the setup only they use', async () => {
    tree.write(
      'apps/web/eslint.config.cjs',
      `const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const { fixupConfigRules } = require('@eslint/compat');
const { configs: { recommended } } = require('@eslint/js');
const nx = require('@nx/eslint-plugin');
const baseConfig = require('../../eslint.config.cjs');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  ...fixupConfigRules(compat.extends('next')),

  ...fixupConfigRules(compat.extends('next/core-web-vitals')),

  recommended,
  ...nx.configs['flat/react-typescript'],
  ...baseConfig,
  {
    ignores: ['.next/**/*'],
  },
];
`
    );

    await migration(tree);

    expect(tree.read('apps/web/eslint.config.cjs', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const nextVitals = require('eslint-config-next/core-web-vitals');
      const {
        configs: { recommended },
      } = require('@eslint/js');
      const nx = require('@nx/eslint-plugin');
      const baseConfig = require('../../eslint.config.cjs');

      module.exports = [
        ...nextVitals,

        recommended,
        ...nx.configs['flat/react-typescript'],
        ...baseConfig,
        {
          ignores: ['.next/**/*'],
        },
      ];
      "
    `);
  });

  it('spreads eslint-config-next in place of the converted compat.extends call and keeps setup that other entries use', async () => {
    tree.write(
      'apps/web/eslint.config.mjs',
      `import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

export default [
  ...compat.extends('next', 'next/core-web-vitals'),
  ...nx.configs['flat/react-typescript'],
  ...baseConfig,
  js.configs.recommended,
];
`
    );

    await migration(tree);

    expect(tree.read('apps/web/eslint.config.mjs', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import nextVitals from 'eslint-config-next/core-web-vitals';
      import js from '@eslint/js';
      import nx from '@nx/eslint-plugin';
      import baseConfig from '../../eslint.config.mjs';

      const eslintConfig = [
        ...nextVitals,
        ...nx.configs['flat/react-typescript'],
        ...baseConfig,
        js.configs.recommended,
      ];

      export default eslintConfig;
      "
    `);
  });

  const pluginOnlyAppConfig = (extra = { imports: '', entries: '' }) =>
    `import nextEslintPluginNext from '@next/eslint-plugin-next';
${extra.imports}
export default [
  { plugins: { '@next/next': nextEslintPluginNext } },
  ${extra.entries}
];
`;

  const rootConfigWithReactHooks = `import reactHooks from 'eslint-plugin-react-hooks';

export default [{ plugins: { 'react-hooks': reactHooks } }];
`;

  it.each([
    [
      'the app config registers a plugin eslint-config-next also registers',
      pluginOnlyAppConfig({
        imports: `import nx from '@nx/eslint-plugin';`,
        entries: `...nx.configs['flat/react'],`,
      }),
      rootConfig,
      'because it registers react, react-hooks, import or jsx-a11y',
      {},
    ],
    [
      'the root config registers a plugin eslint-config-next also registers',
      pluginOnlyAppConfig(),
      rootConfigWithReactHooks,
      'because eslint.config.mjs registers react, react-hooks, import or jsx-a11y',
      {},
    ],
    [
      'a local module the app config imports registers a plugin eslint-config-next also registers',
      pluginOnlyAppConfig({
        imports: `import hooks from '../../tools/eslint/hooks.mjs';`,
        entries: `...hooks,`,
      }),
      rootConfig,
      'because tools/eslint/hooks.mjs registers react, react-hooks, import or jsx-a11y',
      { 'tools/eslint/hooks.mjs': rootConfigWithReactHooks },
    ],
    [
      'a local module the app config loads through import-equals registers a plugin eslint-config-next also registers',
      pluginOnlyAppConfig({
        imports: `import hooks = require('../../tools/eslint/hooks.cjs');`,
        entries: `hooks,`,
      }),
      rootConfig,
      'because tools/eslint/hooks.cjs registers react, react-hooks, import or jsx-a11y',
      {
        'tools/eslint/hooks.cjs': `const reactHooks = require('eslint-plugin-react-hooks');

module.exports = { plugins: { 'react-hooks': reactHooks } };
`,
      },
      'apps/web/eslint.config.cts',
    ],
  ])(
    'adds the core-web-vitals config of @next/eslint-plugin-next in place of the @next/next registration when %s',
    async (
      _,
      appConfig,
      root,
      reason,
      files: Record<string, string>,
      appConfigPath = 'apps/web/eslint.config.mjs'
    ) => {
      tree.write(appConfigPath, appConfig);
      tree.write('eslint.config.mjs', root);
      for (const [file, content] of Object.entries(files)) {
        tree.write(file, content);
      }
      const appConfigPattern = appConfigPath.replaceAll('.', '\\.');

      const result = await migration(tree);

      const migrated = tree.read(appConfigPath, 'utf-8');
      expect(migrated).toContain(
        `import nextEslintPluginNext from '@next/eslint-plugin-next';`
      );
      expect(migrated).toContain(
        `nextEslintPluginNext.configs['core-web-vitals']`
      );
      expect(migrated).not.toContain(`'@next/next'`);
      expect(migrated).not.toContain('eslint-config-next');
      expect(result).toEqual({
        nextSteps: [
          expect.stringMatching(
            new RegExp(
              `^${appConfigPattern} now uses the "core-web-vitals" config of "@next/eslint-plugin-next" .*${reason}`
            )
          ),
        ],
        agentContext: [
          expect.stringMatching(
            new RegExp(
              `${reason}.* eslint-disable comments that name a react/, jsx-a11y/ or import/ rule, in ${appConfigPattern} or in the files it lints, make lint fail .* Delete or rewrite them\\.$`
            )
          ),
        ],
      });

      expect(await migration(tree)).toEqual({ skipAgentic: true });
      expect(tree.read(appConfigPath, 'utf-8')).toBe(migrated);
    }
  );

  it('spreads eslint-config-next when the app config only imports types from local modules that register such plugins', async () => {
    tree.write(
      'apps/web/eslint.config.ts',
      pluginOnlyAppConfig({
        imports: `import type { ReactPreset } from '../../tools/eslint/react';
export type { HooksPreset } from '../../tools/eslint/hooks';
import type ImportPreset = require('../../tools/eslint/import.cjs');`,
        entries: '',
      })
    );
    tree.write(
      'tools/eslint/import.cjs',
      `const importPlugin = require('eslint-plugin-import');

module.exports = { plugins: { import: importPlugin } };
`
    );
    tree.write(
      'tools/eslint/react.ts',
      `import react from 'eslint-plugin-react';

export type ReactPreset = object;
export default [{ plugins: { react } }];
`
    );
    tree.write(
      'tools/eslint/hooks.ts',
      `export type HooksPreset = object;
${rootConfigWithReactHooks}`
    );

    const result = await migration(tree);

    const migrated = tree.read('apps/web/eslint.config.ts', 'utf-8');
    expect(migrated).toContain('...nextVitals');
    expect(migrated).not.toContain('@next/eslint-plugin-next');
    expect(result).toEqual({ skipAgentic: true });
  });

  it.each([
    [
      'the app config already imports eslint-config-next',
      pluginOnlyAppConfig({
        imports: `import nextTypescript from 'eslint-config-next/typescript';`,
        entries: `...nextTypescript,`,
      }),
      rootConfig,
      'because it already imports eslint-config-next',
      'with a spread of the default export of "eslint-config-next/core-web-vitals"',
    ],
    [
      'the root config registers a plugin eslint-config-next also registers and the app extends "next" through FlatCompat',
      `import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [...compat.extends('next', 'next/core-web-vitals')];
`,
      rootConfigWithReactHooks,
      'because eslint.config.mjs registers react, react-hooks, import or jsx-a11y',
      'with the "core-web-vitals" config of "@next/eslint-plugin-next"',
    ],
  ])(
    'reports the config without changing it when %s',
    async (_, appConfig, root, reason, instruction) => {
      tree.write('apps/web/eslint.config.mjs', appConfig);
      tree.write('eslint.config.mjs', root);
      await formatFiles(tree);
      const before = tree.read('apps/web/eslint.config.mjs', 'utf-8');

      const result = await migration(tree);

      expect(tree.read('apps/web/eslint.config.mjs', 'utf-8')).toBe(before);
      expect(result).toEqual({
        nextSteps: [
          expect.stringMatching(
            new RegExp(`^apps/web/eslint\\.config\\.mjs .*${reason}`)
          ),
        ],
        agentContext: [expect.stringContaining(reason)],
      });
      expect(result.nextSteps[0]).toContain(instruction);
    }
  );

  it.each([
    ['the "next" config extended alone', `...compat.extends('next'),`],
    [
      'the generated entries next to another Next.js entry',
      `...compat.extends('next', 'next/core-web-vitals'),
  ...compat.extends('next/typescript'),`,
    ],
  ])(
    'reports %s with the rules eslint-config-next keeps registered',
    async (_, nextEntries) => {
      tree.write(
        'apps/web/eslint.config.mjs',
        `import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  ${nextEntries}
  { rules: { 'react/jsx-key': 'off', 'import/order': 'warn' } },
];
`
      );
      await formatFiles(tree);
      const before = tree.read('apps/web/eslint.config.mjs', 'utf-8');

      const result = await migration(tree);

      expect(tree.read('apps/web/eslint.config.mjs', 'utf-8')).toBe(before);
      expect(result).toEqual({
        nextSteps: [
          expect.stringContaining(
            'Its references to react/jsx-key, import/order keep working'
          ),
        ],
        agentContext: [
          expect.stringContaining('differ from the ones Nx generates'),
        ],
      });
    }
  );
});
