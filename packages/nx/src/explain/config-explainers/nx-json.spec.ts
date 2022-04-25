import { join } from 'path';
import { ensureDescriptionsMatch } from '../test-utils';
import { nxConfigExplainer } from './nx-json';

describe('nx.json explainer', () => {
  it('should keep its description fields in sync with the JSDoc annotations on the interface representing the config', () => {
    expect(() =>
      ensureDescriptionsMatch({
        fileContainingConfigInterface: join(
          __dirname,
          '../../config/nx-json.ts'
        ),
        configInterfaceName: 'NxJsonConfiguration',
        configExplainer: nxConfigExplainer,
      })
    ).not.toThrow();
  });

  describe('extends', () => {
    it('should explain the extends property', () => {
      expect(nxConfigExplainer.extends.explainConfig('nx/presets/npm.json'))
        .toMatchInlineSnapshot(`
        "Your nx.json config is extending a base config found at: \\"nx/presets/npm.json\\". This mean that anything set in your nx.json directly will override the equivalent setting in that base config.

        If you want to inspect the base config you can run:

        npx nx explain nx/presets/npm.json
        "
      `);
    });
  });

  describe('implicitDependencies', () => {
    it('should explain the implicitDependencies property', () => {
      expect(
        nxConfigExplainer.implicitDependencies.explainConfig({
          'package.json': {
            dependencies: '*',
            devDependencies: '*',
            some: {
              'deep-field': ['proj2'],
              'deep-glob-*': ['proj3'],
            },
            'match-*': ['proj4', 'proj5'],
          },
          '.eslintrc.json': '*',
          'scripts/vercel/*': ['nx-dev'],
          'tools/eslint-rules/**/*': '*',
        })
      ).toMatchInlineSnapshot(`
        "Your config instructs Nx's project graph creation logic of the following:

          - Changes to \`dependencies\` within package.json should affect all projects

          - Changes to \`devDependencies\` within package.json should affect all projects

          - Changes to \`some.deep-field\` within package.json should affect the project \`proj2\`

          - Changes to any JSON fields matching the pattern \`some.deep-glob-*\` within package.json should affect the project \`proj3\`

          - Changes to any JSON fields matching the pattern \`match-*\` within package.json should affect the projects \`proj4\`, \`proj5\`

          - Changes to \`.eslintrc.json\` should affect all projects

          - Changes to any files matching the pattern \`scripts/vercel/*\` should affect the project \`nx-dev\`

          - Changes to any files matching the pattern \`tools/eslint-rules/**/*\` should affect all projects"
      `);
    });
  });

  describe('targetDependencies', () => {
    it('should explain the targetDependencies property', () => {
      expect(
        nxConfigExplainer.targetDependencies.explainConfig({
          build: [
            {
              target: 'build',
              projects: 'dependencies',
            },
          ],
          something: [
            {
              target: 'build-base',
              projects: 'self',
            },
            {
              target: 'build',
              projects: 'dependencies',
            },
            {
              target: 'build',
              projects: 'self',
            },
          ],
        })
      ).toMatchInlineSnapshot(`
        "Your config instructs Nx's task graph creation logic of the following:

          - For any given project, before executing a target called \`build\` Nx should first execute:
            - A target called \`build\` on any of the project's dependencies which implement that target

          - For any given project, before executing a target called \`something\` Nx should first execute:
            - The project's own target called \`build-base\`
            - A target called \`build\` on any of the project's dependencies which implement that target
            - The project's own target called \`build\`"
      `);
    });
  });

  describe('npmScope', () => {
    it('should explain the npmScope property', () => {
      expect(nxConfigExplainer.npmScope.explainConfig('myorg'))
        .toMatchInlineSnapshot(`
        "When you generate a new library, e.g. \`my-lib\`, your npmScope value of \`myorg\` will be used when generating the appropriate TypeScript path mappings in your workspace's root tsconfig, such that you can then import any exported symbols from your new library's \`index.ts\` file using \`@myorg/my-lib\` like so:
          
          libs/my-lib/index.ts
          \`\`\`ts
          export { SomeExportedThing } from './lib/something.ts';
          \`\`\`
          
          (within any other workspace app or lib)
          \`\`\`ts
          import { SomeExportedThing } from '@myorg/my-lib';
          \`\`\`"
      `);
    });
  });

  describe('affected', () => {
    it('should explain the affected property', () => {
      expect(
        nxConfigExplainer.affected.explainConfig({
          defaultBase: 'main',
        })
      ).toMatchInlineSnapshot(
        `"You have configured a \`defaultBase\` value of \`main\`, which means that whenever you run an affected command such as \`nx affected:build\`, it is the same as if you had run \`nx affected:build --base=main\`"`
      );
    });
  });

  describe('workspaceLayout', () => {
    it('should explain the workspaceLayout property - DIRECTORIES', () => {
      expect(
        nxConfigExplainer.workspaceLayout.explainConfig({
          libsDir: 'libs',
          appsDir: 'apps',
        })
      ).toMatchInlineSnapshot(`
        "Generators provided by Nx plugins will use this configuration as a reference point to know where to place projects relative to when creating or moving them. In your case:

           - If you were to run \`nx g app my-app\`, the new application would be created at: \`apps/my-app\`

           - If you were to run \`nx g lib my-lib\`, the new library would be created at: \`libs/my-lib\`

        NOTE: For those generators which support controlling the \`directory\`, e.g. via a \`--directory\` flag, that specified directory will also be relative to the specified \`appsDir\` or \`libsDir\`

           - E.g. \`nx g app my-app --directory=sub-dir\` => \`apps/sub-dir/my-app\`

           - E.g. \`nx g lib my-lib --directory=sub-dir\` => \`libs/sub-dir/my-lib\`"
      `);
    });

    it('should explain the workspaceLayout property - ROOT', () => {
      expect(
        nxConfigExplainer.workspaceLayout.explainConfig({
          libsDir: '',
          appsDir: '',
        })
      ).toMatchInlineSnapshot(`
        "Generators provided by Nx plugins will use this configuration as a reference point to know where to place projects relative to when creating or moving them. In your case:

           - If you were to run \`nx g app my-app\`, the new application would be created at: \`./my-app\`

           - If you were to run \`nx g lib my-lib\`, the new library would be created at: \`./my-lib\`

        NOTE: For those generators which support controlling the \`directory\`, e.g. via a \`--directory\` flag, that specified directory will also be relative to the specified \`appsDir\` or \`libsDir\`

           - E.g. \`nx g app my-app --directory=sub-dir\` => \`./sub-dir/my-app\`

           - E.g. \`nx g lib my-lib --directory=sub-dir\` => \`./sub-dir/my-lib\`"
      `);
    });
  });

  describe('tasksRunnerOptions', () => {
    it('should explain the tasksRunnerOptions property - DEFAULT RUNNER', () => {
      expect(
        nxConfigExplainer.tasksRunnerOptions.explainConfig({
          default: {
            runner: 'nx/tasks-runners/default',
            options: {
              cacheableOperations: ['build', 'lint', 'test', 'e2e'],
            },
          },
        })
      ).toMatchInlineSnapshot(`
        "Your \`default\` task runner is using the \`nx/tasks-runners/default\` runner.

        To learn more about configuring Nx task runners, see https://nx.dev/configuration/projectjson#tasks-runner-options

        P.S. Have you considered enabling Nx Cloud? It's free for most workspaces. Learn how to add Nx Cloud to your workspace here: https://nx.app/docs/add-nx-cloud-to-workspace#adding-nx-cloud-to-an-existing-workspace"
      `);
    });

    it('should explain the tasksRunnerOptions property - NX CLOUD RUNNER', () => {
      expect(
        nxConfigExplainer.tasksRunnerOptions.explainConfig({
          default: {
            runner: '@nrwl/nx-cloud',
            options: {
              cacheableOperations: ['build', 'lint', 'test', 'e2e'],
              accessToken: 'abc123',
            },
          },
        })
      ).toMatchInlineSnapshot(`
        "Your \`default\` task runner is using the \`@nrwl/nx-cloud\` runner.

        To learn more about configuring Nx task runners, see https://nx.dev/configuration/projectjson#tasks-runner-options"
      `);
    });

    it('should explain the tasksRunnerOptions property - MULTIPLE RUNNERS', () => {
      expect(
        nxConfigExplainer.tasksRunnerOptions.explainConfig({
          default: {
            runner: '@nrwl/nx-cloud',
            options: {
              cacheableOperations: ['build', 'lint', 'test', 'e2e'],
              accessToken: 'abc123',
            },
          },
          anotherCompletelyCustomRunner: {
            runner: 'completely/custom/runner',
            options: {
              foo: true,
              optionsHereAre: 'arbitrary',
            },
          },
        })
      ).toMatchInlineSnapshot(`
        "You have configured the following 2 Nx task runners:

          - \`default\` using runner \`@nrwl/nx-cloud\`

          - \`anotherCompletelyCustomRunner\` using runner \`completely/custom/runner\`

        To learn more about configuring Nx task runners, see https://nx.dev/configuration/projectjson#tasks-runner-options"
      `);
    });
  });

  describe('generators', () => {
    it('should explain the generators property - COLON STYLE', () => {
      expect(
        nxConfigExplainer.generators.explainConfig({
          '@nrwl/angular:application': {
            style: 'css',
            linter: 'eslint',
            unitTestRunner: 'jest',
            e2eTestRunner: 'cypress',
          },
          '@nrwl/angular:library': {
            linter: 'eslint',
            unitTestRunner: 'jest',
          },
          '@nrwl/angular:component': {
            style: 'css',
          },
        })
      ).toMatchInlineSnapshot(`
        "You are instructing the generator \`@nrwl/angular:application\` to use the following settings by default:

           \`style\` is set to \`\\"css\\"\`

           \`linter\` is set to \`\\"eslint\\"\`

           \`unitTestRunner\` is set to \`\\"jest\\"\`

           \`e2eTestRunner\` is set to \`\\"cypress\\"\`

        → You are instructing the generator \`@nrwl/angular:library\` to use the following settings by default:

           \`linter\` is set to \`\\"eslint\\"\`

           \`unitTestRunner\` is set to \`\\"jest\\"\`

        → You are instructing the generator \`@nrwl/angular:component\` to use the following settings by default:

           \`style\` is set to \`\\"css\\"\`

        NOTE: These defaults can still be overridden when the generators are invoked.

        Please consult each generator's respective documentation for more information on the available settings"
      `);
    });

    it('should explain the generators property - NESTED STYLE', () => {
      expect(
        nxConfigExplainer.generators.explainConfig({
          '@nrwl/react': {
            application: {
              style: 'css',
              linter: 'eslint',
              babel: true,
            },
            component: {
              style: 'css',
            },
            library: {
              style: 'css',
              linter: 'eslint',
            },
          },
        })
      ).toMatchInlineSnapshot(`
        "You are instructing the generator \`@nrwl/react:application\` to use the following settings by default:

           \`style\` is set to \`\\"css\\"\`

           \`linter\` is set to \`\\"eslint\\"\`

           \`babel\` is set to \`true\`

        → You are instructing the generator \`@nrwl/react:component\` to use the following settings by default:

           \`style\` is set to \`\\"css\\"\`

        → You are instructing the generator \`@nrwl/react:library\` to use the following settings by default:

           \`style\` is set to \`\\"css\\"\`

           \`linter\` is set to \`\\"eslint\\"\`

        NOTE: These defaults can still be overridden when the generators are invoked.

        Please consult each generator's respective documentation for more information on the available settings"
      `);
    });

    it('should explain the generators property - MIXED STYLE', () => {
      expect(
        nxConfigExplainer.generators.explainConfig({
          '@nrwl/react': {
            application: {
              style: 'css',
              linter: 'eslint',
              babel: true,
            },
          },
          '@nrwl/angular:application': {
            style: 'css',
            linter: 'eslint',
            unitTestRunner: 'jest',
            e2eTestRunner: 'cypress',
          },
        })
      ).toMatchInlineSnapshot(`
        "You are instructing the generator \`@nrwl/react:application\` to use the following settings by default:

           \`style\` is set to \`\\"css\\"\`

           \`linter\` is set to \`\\"eslint\\"\`

           \`babel\` is set to \`true\`

        → You are instructing the generator \`@nrwl/angular:application\` to use the following settings by default:

           \`style\` is set to \`\\"css\\"\`

           \`linter\` is set to \`\\"eslint\\"\`

           \`unitTestRunner\` is set to \`\\"jest\\"\`

           \`e2eTestRunner\` is set to \`\\"cypress\\"\`

        NOTE: These defaults can still be overridden when the generators are invoked.

        Please consult each generator's respective documentation for more information on the available settings"
      `);
    });
  });

  describe('cli', () => {
    it('should explain the cli property', () => {
      expect(
        nxConfigExplainer.cli.explainConfig({
          defaultCollection: '@nrwl/react',
        })
      ).toMatchInlineSnapshot(
        `"The default collection is set to \`@nrwl/react\`, which means that when you run a generator command such as \`nx generate application\` or \`nx g app\`, without an explicit collection, it is the same as if you had run \`nx generate @nrwl/react:application\` or \`nx g @nrwl/react:app\`"`
      );
    });
  });

  describe('plugins', () => {
    it('should explain the plugins property', () => {
      expect(
        nxConfigExplainer.plugins.explainConfig(['./my-plugin.js'])
      ).toMatchInlineSnapshot(
        `"Whilst constructing the project graph in order to understand how all your workspace projects fit together, Nx will resolve the plugin file located at \`./my-plugin.js\` and invoke its \`processProjectGraph()\` method in order to influence the final graph it creates"`
      );
    });
  });

  describe('pluginsConfig', () => {
    it('should explain the pluginsConfig property', () => {
      expect(
        nxConfigExplainer.pluginsConfig.explainConfig({
          '@nrwl/jest': {
            hashingExcludesTestsOfDeps: true,
          },
          '@nrwl/cypress': {
            hashingExcludesTestsOfDeps: true,
          },
        })
      ).toMatchInlineSnapshot(`
        "You are passing the following settings to the plugin \`@nrwl/jest\`:

           - \`hashingExcludesTestsOfDeps\` is set to \`true\`

        → You are passing the following settings to the plugin \`@nrwl/cypress\`:

           - \`hashingExcludesTestsOfDeps\` is set to \`true\`

        Please consult each plugin's respective documentation for more information on the available settings"
      `);
    });
  });

  describe('defaultProject', () => {
    it('should explain the defaultProject property', () => {
      expect(
        nxConfigExplainer.defaultProject.explainConfig('some-project-name')
      ).toMatchInlineSnapshot(
        `"You have configured a \`defaultProject\` value of \`some-project-name\`, which means that whenever you run an Nx target/run command such as \`nx build\` or \`nx run build\`, without an explicit project name, it is the same as if you had run \`nx build some-project-name\` or \`nx run some-project-name:build\`"`
      );
    });
  });
});
