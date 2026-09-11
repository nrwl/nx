import '@nx/devkit/internal-testing-utils/mock-project-graph';

import {
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import pluginGenerator from '../plugin/plugin';
import { createPackageGenerator } from './create-package';
import { CreatePackageSchema } from './schema';
import { setCwd } from '@nx/devkit/internal-testing-utils';
import { tsLibVersion } from '@nx/js/internal';
import { PackageJson, nxVersion } from '@nx/devkit/internal';
import { sep } from 'node:path';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

interface PackageManagerSelection {
  determinePackageManager: (explicit: string | undefined) => string;
  parseArgs: (argv: string[]) => {
    name: string | undefined;
    packageManager: string | undefined;
  };
}

/**
 * Transpiles the selection helpers out of the generated CLI and returns them,
 * so the code that ships to plugin consumers is exercised rather than
 * pattern-matched. `sep` is a free variable here because the import sits above
 * the sliced region.
 */
function loadPackageManagerSelection(cli: string): PackageManagerSelection {
  const start = cli.indexOf('const packageManagers');
  const end = cli.indexOf('async function main');

  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);

  const { outputText } = transpileModule(cli.slice(start, end), {
    compilerOptions: {
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ES2021,
    },
  });

  return new Function(
    'sep',
    `${outputText}\nreturn { determinePackageManager, parseArgs };`
  )(sep);
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

const getSchema: (
  overrides?: Partial<CreatePackageSchema>
) => CreatePackageSchema = (overrides = {}) => ({
  name: 'create-a-workspace',
  directory: 'packages/create-a-workspace',
  project: 'my-plugin',
  compiler: 'tsc',
  skipTsConfig: false,
  skipFormat: false,
  skipLintChecks: false,
  linter: 'eslint',
  unitTestRunner: 'jest',
  ...overrides,
});

describe('NxPlugin Create Package Generator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    setCwd('');
    await pluginGenerator(tree, {
      name: 'my-plugin',
      directory: 'packages/my-plugin',
      compiler: 'tsc',
      skipTsConfig: false,
      skipFormat: false,
      skipLintChecks: false,
      linter: 'eslint',
      unitTestRunner: 'jest',
    });
  });

  it('should update the project.json file', async () => {
    await createPackageGenerator(tree, getSchema());
    const project = readProjectConfiguration(tree, 'create-a-workspace');
    expect(project.root).toEqual('packages/create-a-workspace');
    expect(project.sourceRoot).toEqual('packages/create-a-workspace/bin');
    expect(project.targets.build).toEqual({
      executor: '@nx/js:tsc',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: 'dist/packages/create-a-workspace',
        tsConfig: 'packages/create-a-workspace/tsconfig.lib.json',
        main: 'packages/create-a-workspace/bin/index.ts',
        assets: ['packages/create-a-workspace/*.md'],
      },
    });
  });

  describe('generated CLI package manager selection', () => {
    let userAgentBackup: string | undefined;
    let execPathBackup: string | undefined;

    beforeEach(() => {
      userAgentBackup = process.env.npm_config_user_agent;
      execPathBackup = process.env.npm_execpath;
      delete process.env.npm_config_user_agent;
      delete process.env.npm_execpath;
    });

    afterEach(() => {
      restoreEnv('npm_config_user_agent', userAgentBackup);
      restoreEnv('npm_execpath', execPathBackup);
    });

    async function generateCli(): Promise<string> {
      await createPackageGenerator(tree, getSchema());
      return tree.read('packages/create-a-workspace/bin/index.ts', 'utf-8');
    }

    it('should not bake the generating workspace manager into the CLI', async () => {
      const cli = await generateCli();

      // A baked manager is the regression: the consumer's npm downloads the CLI
      // and the CLI then demands the author's manager, which it never installs.
      expect(cli).not.toMatch(/packageManager: '(npm|pnpm|yarn|bun)'/);
      expect(cli).toContain(
        'packageManager: determinePackageManager(packageManager)'
      );
    });

    it('should let an explicit --packageManager win', async () => {
      const { determinePackageManager, parseArgs } =
        loadPackageManagerSelection(await generateCli());

      expect(determinePackageManager('pnpm')).toEqual('pnpm');
      expect(parseArgs(['my-workspace', '--packageManager=pnpm'])).toEqual({
        name: 'my-workspace',
        packageManager: 'pnpm',
      });
      expect(parseArgs(['--pm', 'yarn', 'my-workspace'])).toEqual({
        name: 'my-workspace',
        packageManager: 'yarn',
      });
      expect(() => determinePackageManager('nmp')).toThrow(/must be one of/);
    });

    it('should otherwise detect the invoking manager, falling back to npm', async () => {
      const { determinePackageManager } = loadPackageManagerSelection(
        await generateCli()
      );

      process.env.npm_config_user_agent = 'pnpm/9.12.0 npm/? node/v22.9.0';
      expect(determinePackageManager(undefined)).toEqual('pnpm');

      delete process.env.npm_config_user_agent;
      process.env.npm_execpath = `${sep}usr${sep}local${sep}bin${sep}yarn${sep}yarn.js`;
      expect(determinePackageManager(undefined)).toEqual('yarn');

      delete process.env.npm_execpath;
      expect(determinePackageManager(undefined)).toEqual('npm');
    });
  });

  it('should place the create-package plugin in a directory', async () => {
    await createPackageGenerator(
      tree,
      getSchema({
        directory: 'clis/create-a-workspace',
      } as Partial<CreatePackageSchema>)
    );
    const project = readProjectConfiguration(tree, 'create-a-workspace');
    expect(project.root).toEqual('clis/create-a-workspace');
  });

  it('should create a preset generator in the plugin', async () => {
    await createPackageGenerator(tree, getSchema());

    expect(
      tree.exists('packages/my-plugin/src/generators/preset/generator.ts')
    ).toBeTruthy();
  });

  it('should specify tsc as compiler', async () => {
    await createPackageGenerator(
      tree,
      getSchema({
        compiler: 'tsc',
      })
    );

    const { build } = readProjectConfiguration(
      tree,
      'create-a-workspace'
    ).targets;

    expect(build.executor).toEqual('@nx/js:tsc');
  });

  it('should specify swc as compiler', async () => {
    await createPackageGenerator(
      tree,
      getSchema({
        compiler: 'swc',
      })
    );

    const { build } = readProjectConfiguration(
      tree,
      'create-a-workspace'
    ).targets;

    expect(build.executor).toEqual('@nx/js:swc');
  });

  it("should use name as default for the package.json's name", async () => {
    await createPackageGenerator(tree, getSchema());

    const { root } = readProjectConfiguration(tree, 'create-a-workspace');
    const { name } = readJson<PackageJson>(
      tree,
      joinPathFragments(root, 'package.json')
    );

    expect(name).toEqual('create-a-workspace');
  });

  it("should have valid default package.json's dependencies", async () => {
    await createPackageGenerator(tree, getSchema());

    const { root } = readProjectConfiguration(tree, 'create-a-workspace');
    const { dependencies } = readJson<PackageJson>(
      tree,
      joinPathFragments(root, 'package.json')
    );

    expect(dependencies).toEqual(
      expect.objectContaining({
        'create-nx-workspace': nxVersion,
        tslib: tsLibVersion,
      })
    );
  });

  it('should budget the e2e test for a cold package manager cache', async () => {
    await pluginGenerator(tree, {
      name: 'with-e2e',
      directory: 'packages/with-e2e',
      compiler: 'tsc',
      skipTsConfig: false,
      skipFormat: false,
      skipLintChecks: false,
      linter: 'eslint',
      unitTestRunner: 'jest',
      e2eTestRunner: 'jest',
    });

    await createPackageGenerator(
      tree,
      getSchema({ project: 'with-e2e', e2eProject: 'with-e2e-e2e' })
    );

    // The test shells out synchronously, which jest cannot interrupt but vitest
    // fails after the fact, so an under-budgeted test is an intermittent
    // failure rather than a consistent one.
    const spec = tree.read(
      'packages/with-e2e-e2e/src/create-a-workspace.spec.ts',
      'utf-8'
    );
    const budget = /\}, (\d[\d_]*)\);/.exec(spec);

    expect(budget).not.toBeNull();
    expect(Number(budget[1].replace(/_/g, ''))).toBeGreaterThanOrEqual(120_000);
  });
});
