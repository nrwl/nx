import {
  addProjectConfiguration,
  logger,
  readJson,
  writeJson,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-directive-checks-rule';

let projectGraph: ProjectGraph;
vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  createProjectGraphAsync: () => Promise.resolve(projectGraph),
}));

const FLAT_CONFIG = `import nx from '@nx/eslint-plugin';

export default [...nx.configs['flat/base']];
`;

describe('add-directive-checks-rule migration', () => {
  let tree: Tree;
  let envBackup: string | undefined;

  /** Adds a test file and the targets a runner plugin infers for it. */
  function addE2eProject(
    specContent: string,
    { ciTargetName = 'e2e-ci', file = 'src/checkout.spec.ts' } = {}
  ) {
    const targets = { [ciTargetName]: {}, [`${ciTargetName}--${file}`]: {} };
    addProjectConfiguration(tree, 'e2e', { root: 'apps/e2e', targets });
    projectGraph = {
      dependencies: {},
      nodes: {
        e2e: { name: 'e2e', type: 'e2e', data: { root: 'apps/e2e', targets } },
      },
    };
    tree.write(`apps/e2e/${file}`, specContent);
  }

  beforeEach(() => {
    envBackup = process.env.ESLINT_USE_FLAT_CONFIG;
    tree = createTreeWithEmptyWorkspace();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (envBackup === undefined) {
      delete process.env.ESLINT_USE_FLAT_CONFIG;
    } else {
      process.env.ESLINT_USE_FLAT_CONFIG = envBackup;
    }
  });

  describe('flat config', () => {
    beforeEach(() => {
      process.env.ESLINT_USE_FLAT_CONFIG = 'true';
      tree.write('eslint.config.mjs', FLAT_CONFIG);
    });

    it.each([
      ['@nx-ignore-server-inputs', '// @nx-ignore-server-inputs\n'],
      ['@nx-depends-on', '// @nx-depends-on: api, web\n'],
    ])(
      'should add the rule without a files pattern for %s',
      async (_, header) => {
        addE2eProject(`${header}test('checks out', () => {});\n`);

        await update(tree);

        const config = tree.read('eslint.config.mjs', 'utf-8');
        expect(config).toContain("'@nx/directive-checks': 'error'");
        expect(config).not.toContain('files');
      }
    );

    it('should not add the rule twice', async () => {
      addE2eProject('// @nx-ignore-server-inputs\n');

      await update(tree);
      const afterFirstRun = tree.read('eslint.config.mjs', 'utf-8');
      await update(tree);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toBe(afterFirstRun);
    });

    it('should not change the config when the rule is already configured', async () => {
      const configured = `${FLAT_CONFIG}\n// '@nx/directive-checks': 'off'\n`;
      tree.write('eslint.config.mjs', configured);
      addE2eProject('// @nx-ignore-server-inputs\n');

      await update(tree);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toBe(configured);
    });

    it('should not add the rule when the only directive is @nx-target-name', async () => {
      addE2eProject('// @nx-target-name: serve\n');

      await update(tree);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toBe(FLAT_CONFIG);
    });

    it('should not add the rule when a directive is outside the leading comment block', async () => {
      addE2eProject("import x from 'x';\n// @nx-ignore-server-inputs\n");

      await update(tree);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toBe(FLAT_CONFIG);
    });

    it.each([
      ['a CI target name', { ciTargetName: 'browser--ci' }],
      ['a file path', { file: 'src/checkout--mobile.spec.ts' }],
    ])('should add the rule when %s contains "--"', async (_, names) => {
      addE2eProject('// @nx-ignore-server-inputs\n', names);

      await update(tree);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toContain(
        "'@nx/directive-checks': 'error'"
      );
    });

    it('should not read a file that only the end of a split file path names', async () => {
      addE2eProject("test('checks out', () => {});\n", {
        file: 'src/checkout--mobile.spec.ts',
      });
      tree.write('apps/e2e/mobile.spec.ts', '// @nx-ignore-server-inputs\n');

      await update(tree);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toBe(FLAT_CONFIG);
    });

    it.each([
      [
        'registers @nx only in a project config',
        'eslint.config.mjs',
        {
          'eslint.config.mjs': 'export default [];\n',
          'apps/e2e/eslint.config.mjs': FLAT_CONFIG,
        },
      ],
      [
        'scopes flat/base to some files',
        'eslint.config.mjs',
        {
          'eslint.config.mjs': `import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'].map((config) => ({ ...config, files: ['**/*.ts'] })),
];
`,
        },
      ],
      [
        "spreads another plugin's flat/base",
        'eslint.config.mjs',
        {
          'eslint.config.mjs': `import nx from '@nx/eslint-plugin';
import other from 'eslint-plugin-other';

export default [...other.configs['flat/base']];
`,
        },
      ],
      [
        'mentions flat/base only in a comment',
        'eslint.config.mjs',
        {
          'eslint.config.mjs': `import nx from '@nx/eslint-plugin';

// ...nx.configs['flat/base'],
export default [];
`,
        },
      ],
      [
        'spreads flat/base outside the exported array',
        'eslint.config.mjs',
        {
          'eslint.config.mjs': `import nx from '@nx/eslint-plugin';

const base = [...nx.configs['flat/base']];

export default [];
`,
        },
      ],
      [
        'has a base config that does not register @nx',
        'eslint.base.config.mjs',
        {
          'eslint.base.config.mjs': 'export default [];\n',
          'eslint.config.mjs': `import nx from '@nx/eslint-plugin';
import baseConfig from './eslint.base.config.mjs';

export default [...baseConfig, ...nx.configs['flat/base']];
`,
        },
      ],
    ])(
      'should warn and not add the rule when the workspace %s',
      async (_, warnedConfig, files: Record<string, string>) => {
        for (const [path, content] of Object.entries(files)) {
          tree.write(path, content);
        }
        addE2eProject('// @nx-ignore-server-inputs\n');
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        await update(tree);

        for (const [path, content] of Object.entries(files)) {
          expect(tree.read(path, 'utf-8')).toBe(content);
        }
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining(`Could not verify that \`${warnedConfig}\``)
        );
      }
    );

    // Project configs import the base config directly, not the root config.
    it.each([
      [
        'next to the root project config that imports it',
        "import baseConfig from './eslint.base.config.mjs';\n\nexport default [...baseConfig];\n",
      ],
      ['without a root config', undefined],
    ])('should add the rule to the base config %s', async (_, rootConfig) => {
      tree.write('eslint.base.config.mjs', FLAT_CONFIG);
      if (rootConfig === undefined) {
        tree.delete('eslint.config.mjs');
      } else {
        tree.write('eslint.config.mjs', rootConfig);
      }
      addE2eProject('// @nx-ignore-server-inputs\n');

      await update(tree);

      expect(tree.read('eslint.base.config.mjs', 'utf-8')).toContain(
        "'@nx/directive-checks': 'error'"
      );
      expect(tree.read('eslint.config.mjs', 'utf-8')).toBe(rootConfig ?? null);
    });

    it('should add the rule to the flat config when an eslintrc config is also present', async () => {
      delete process.env.ESLINT_USE_FLAT_CONFIG;
      writeJson(tree, '.eslintrc.json', {
        root: true,
        plugins: ['@nx'],
        overrides: [],
      });
      addE2eProject('// @nx-ignore-server-inputs\n');

      await update(tree);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toContain(
        "'@nx/directive-checks': 'error'"
      );
      expect(readJson(tree, '.eslintrc.json').rules).toBeUndefined();
    });

    it('should add the rule to a CommonJS config', async () => {
      tree.delete('eslint.config.mjs');
      tree.write(
        'eslint.config.cjs',
        "const nx = require('@nx/eslint-plugin');\n\nmodule.exports = [...nx.configs['flat/base']];\n"
      );
      addE2eProject('// @nx-ignore-server-inputs\n');

      await update(tree);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toContain(
        "'@nx/directive-checks': 'error'"
      );
    });

    it('should not add the rule when @nx/eslint-plugin is not used', async () => {
      const config = 'export default [];\n';
      tree.write('eslint.config.mjs', config);
      addE2eProject('// @nx-ignore-server-inputs\n');

      await update(tree);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toBe(config);
    });
  });

  describe('.eslintrc.json', () => {
    const legacyConfig = {
      root: true,
      plugins: ['@nx'],
      overrides: [],
    };

    beforeEach(() => {
      process.env.ESLINT_USE_FLAT_CONFIG = 'false';
      writeJson(tree, '.eslintrc.json', legacyConfig);
    });

    it('should add the rule to the top-level rules', async () => {
      writeJson(tree, '.eslintrc.json', {
        ...legacyConfig,
        rules: { 'no-console': 'warn' },
      });
      addE2eProject('// @nx-depends-on: api\n');

      await update(tree);

      expect(readJson(tree, '.eslintrc.json')).toEqual({
        ...legacyConfig,
        rules: { 'no-console': 'warn', '@nx/directive-checks': 'error' },
      });
    });

    it('should warn and not add the rule when only a project config registers @nx', async () => {
      const rootConfig = { root: true, overrides: [] };
      writeJson(tree, '.eslintrc.json', rootConfig);
      writeJson(tree, 'apps/e2e/.eslintrc.json', {
        extends: ['../../.eslintrc.json'],
        plugins: ['@nx'],
      });
      addE2eProject('// @nx-depends-on: api\n');
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      await update(tree);

      expect(readJson(tree, '.eslintrc.json')).toEqual(rootConfig);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not verify that `.eslintrc.json`')
      );
    });

    // Project configs extend the base config directly, not the root config.
    it('should add the rule to the base config', async () => {
      writeJson(tree, '.eslintrc.base.json', legacyConfig);
      const rootConfig = {
        extends: ['./.eslintrc.base.json'],
        overrides: [],
      };
      writeJson(tree, '.eslintrc.json', rootConfig);
      addE2eProject('// @nx-depends-on: api\n');

      await update(tree);

      expect(readJson(tree, '.eslintrc.base.json')).toEqual({
        ...legacyConfig,
        rules: { '@nx/directive-checks': 'error' },
      });
      expect(readJson(tree, '.eslintrc.json')).toEqual(rootConfig);
    });

    it('should not change the config when no file has the directives', async () => {
      addE2eProject('test("x", () => {});\n');

      await update(tree);

      expect(readJson(tree, '.eslintrc.json')).toEqual(legacyConfig);
    });
  });

  it('should skip workspaces without an ESLint config', async () => {
    addE2eProject('// @nx-ignore-server-inputs\n');

    await update(tree);

    expect(tree.exists('eslint.config.mjs')).toBe(false);
    expect(tree.exists('.eslintrc.json')).toBe(false);
  });
});
