import { formatFiles, type Tree } from '@nx/devkit';
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

  it('spreads eslint-config-next in place of the generated FlatCompat entries and removes their setup', async () => {
    tree.write(
      'apps/web/eslint.config.cjs',
      `const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const { fixupConfigRules } = require('@eslint/compat');
const nx = require('@nx/eslint-plugin');
const baseConfig = require('../../eslint.config.cjs');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  ...fixupConfigRules(compat.extends('next')),

  ...fixupConfigRules(compat.extends('next/core-web-vitals')),

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
      const nx = require('@nx/eslint-plugin');
      const baseConfig = require('../../eslint.config.cjs');

      module.exports = [
        ...nextVitals,

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
    ],
    [
      'the root config registers a plugin eslint-config-next also registers',
      pluginOnlyAppConfig(),
      rootConfigWithReactHooks,
      'because eslint.config.mjs registers react, react-hooks, import or jsx-a11y',
    ],
  ])(
    'adds the core-web-vitals config of @next/eslint-plugin-next in place of the @next/next registration when %s',
    async (_, appConfig, root, reason) => {
      tree.write('apps/web/eslint.config.mjs', appConfig);
      tree.write('eslint.config.mjs', root);

      const result = await migration(tree);

      const migrated = tree.read('apps/web/eslint.config.mjs', 'utf-8');
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
              `^apps/web/eslint\\.config\\.mjs now uses the "core-web-vitals" config of "@next/eslint-plugin-next" .*${reason}`
            )
          ),
        ],
        agentContext: [
          expect.stringMatching(
            new RegExp(
              `${reason}.* eslint-disable comments that name a react/, jsx-a11y/ or import/ rule, in apps/web/eslint\\.config\\.mjs or in the files it lints, make lint fail .* Delete or rewrite them\\.$`
            )
          ),
        ],
      });

      expect(await migration(tree)).toEqual({ skipAgentic: true });
      expect(tree.read('apps/web/eslint.config.mjs', 'utf-8')).toBe(migrated);
    }
  );

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
