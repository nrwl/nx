import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  type ProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateNxJson,
} from '@nx/devkit';
import convertToInferred from './convert-to-inferred';

interface CreateProjectOptions {
  name: string;
  root: string;
  targetName: string;
  targetOptions: Record<string, unknown>;
  targetOutputs: string[];
  targetInputs?: unknown[];
  additionalTargetProperties?: Record<string, unknown>;
}

const defaultCreateProjectOptions: CreateProjectOptions = {
  name: 'mypkg',
  root: 'mypkg',
  targetName: 'build',
  targetOptions: {},
  targetOutputs: ['{options.outputPath}'],
};

function createProject(tree: Tree, opts: Partial<CreateProjectOptions> = {}) {
  const projectOpts = {
    ...defaultCreateProjectOptions,
    ...opts,
    targetOptions:
      opts.targetOptions === null ? undefined : { ...opts.targetOptions },
  };

  if (projectOpts.targetOptions) {
    projectOpts.targetOptions.main ??= `${projectOpts.root}/src/index.ts`;
    projectOpts.targetOptions.outputPath ??= `dist/${projectOpts.root}`;
    projectOpts.targetOptions.tsConfig ??= `${projectOpts.root}/tsconfig.lib.json`;
    projectOpts.targetOptions.compiler ??= 'babel';
    projectOpts.targetOptions.format ??= ['esm'];
    projectOpts.targetOptions.external ??= [];
    projectOpts.targetOptions.assets ??= [];
  }

  const project: ProjectConfiguration = {
    name: projectOpts.name,
    root: projectOpts.root,
    projectType: 'library',
    targets: {
      [projectOpts.targetName]: {
        executor: '@nx/rollup:rollup',
        outputs: projectOpts.targetOutputs ?? ['{options.outputPath}'],
        options: projectOpts.targetOptions,
        ...projectOpts.additionalTargetProperties,
      },
    },
  };

  addProjectConfiguration(tree, project.name, project);

  return project;
}

describe('Rollup - Convert Executors To Plugin', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('--project', () => {
    it('should setup a new Rollup plugin and only migrate one specific project', async () => {
      const project = createProject(tree, {
        name: 'mypkg',
        root: 'mypkg',
      });
      createProject(tree, {
        name: 'otherpkg1',
        root: 'otherpkg1',
      });
      createProject(tree, {
        name: 'otherpkg2',
        root: 'otherpkg2',
      });

      await convertToInferred(tree, { project: project.name });

      expect(readNxJson(tree).plugins).toEqual([
        {
          options: {
            targetName: 'build',
          },
          plugin: '@nx/rollup/plugin',
        },
      ]);
      expect(tree.read('mypkg/rollup.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withNx } = require('@nx/rollup/with-nx');

        // These options were migrated by @nx/rollup:convert-to-inferred from project.json
        const options = {
          main: './src/index.ts',
          outputPath: '../dist/mypkg',
          tsConfig: './tsconfig.lib.json',
          compiler: 'babel',
          format: ['esm'],
          external: [],
          assets: [],
        };

        const config = withNx(options, {
          // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
          // e.g.
          // output: { sourcemap: true },
        });

        module.exports = config;
        "
      `);
      expect(tree.exists('otherpkg1/rollup.config.js')).toBe(false);
      expect(tree.exists('otherpkg2/rollup.config.js')).toBe(false);
      expect(readProjectConfiguration(tree, project.name).targets).toEqual({});
    });

    it('should support existing rollupConfig files', async () => {
      const projectWithSingleConfig = createProject(tree, {
        name: 'mypkg1',
        root: 'mypkg1',
        targetOptions: {
          rollupConfig: '@nx/react/plugins/bundle-rollup',
        },
      });
      const projectWithMultipleConfigsAndEntries = createProject(tree, {
        name: 'mypkg2',
        root: 'mypkg2',
        targetOptions: {
          additionalEntryPoints: ['mypkg2/src/foo.ts', 'mypkg2/src/bar.ts'],
          rollupConfig: [
            '@nx/react/plugins/bundle-rollup',
            'mypkg2/rollup.config.other.js',
            'shared/rollup.config.base.js',
          ],
        },
      });

      await convertToInferred(tree, { project: projectWithSingleConfig.name });
      await convertToInferred(tree, {
        project: projectWithMultipleConfigsAndEntries.name,
      });

      expect(tree.read('mypkg1/rollup.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withNx } = require('@nx/rollup/with-nx');

        // These options were migrated by @nx/rollup:convert-to-inferred from project.json
        const options = {
          main: './src/index.ts',
          outputPath: '../dist/mypkg1',
          tsConfig: './tsconfig.lib.json',
          compiler: 'babel',
          format: ['esm'],
          external: [],
          assets: [],
        };

        let config = withNx(options, {
          // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
          // e.g.
          // output: { sourcemap: true },
        });

        config = require('@nx/react/plugins/bundle-rollup')(config, options);

        module.exports = config;
        "
      `);
      expect(tree.read('mypkg2/rollup.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withNx } = require('@nx/rollup/with-nx');

        // These options were migrated by @nx/rollup:convert-to-inferred from project.json
        const options = {
          additionalEntryPoints: ['./src/foo.ts', './src/bar.ts'],
          main: './src/index.ts',
          outputPath: '../dist/mypkg2',
          tsConfig: './tsconfig.lib.json',
          compiler: 'babel',
          format: ['esm'],
          external: [],
          assets: [],
        };

        let config = withNx(options, {
          // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
          // e.g.
          // output: { sourcemap: true },
        });

        config = require('@nx/react/plugins/bundle-rollup')(config, options);
        config = require('./rollup.config.other.js')(config, options);
        config = require('../shared/rollup.config.base.js')(config, options);

        module.exports = config;
        "
      `);

      expect(
        readProjectConfiguration(tree, projectWithSingleConfig.name).targets
      ).toEqual({});
      expect(
        readProjectConfiguration(
          tree,
          projectWithMultipleConfigsAndEntries.name
        ).targets
      ).toEqual({});
    });

    it('should handle conflicts with existing rollup.config.js file', async () => {
      const project = createProject(tree, {
        name: 'mypkg1',
        root: 'mypkg1',
        targetOptions: {
          rollupConfig: [
            'mypkg1/rollup.config.js',
            'mypkg1/rollup.other.config.js',
          ],
        },
      });
      tree.write(
        'mypkg1/rollup.config.js',
        '// existing config\nmodule.exports = {};'
      );

      await convertToInferred(tree, { project: project.name });

      expect(tree.read('mypkg1/rollup.migrated.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "// existing config
        module.exports = {};
        "
      `);
      expect(tree.read('mypkg1/rollup.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withNx } = require('@nx/rollup/with-nx');

        // These options were migrated by @nx/rollup:convert-to-inferred from project.json
        const options = {
          main: './src/index.ts',
          outputPath: '../dist/mypkg1',
          tsConfig: './tsconfig.lib.json',
          compiler: 'babel',
          format: ['esm'],
          external: [],
          assets: [],
        };

        let config = withNx(options, {
          // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
          // e.g.
          // output: { sourcemap: true },
        });

        config = require('./rollup.migrated.config.js')(config, options);
        config = require('./rollup.other.config.js')(config, options);

        module.exports = config;
        "
      `);
    });

    it('should migrate existing outputs to include output from rollup config', async () => {
      const project = createProject(tree, {
        name: 'mypkg',
        root: 'mypkg',
        targetOutputs: [
          '{options.outputPath}',
          '{projectRoot}/other-artifacts',
        ],
      });

      await convertToInferred(tree, { project: project.name });

      expect(readProjectConfiguration(tree, project.name).targets).toEqual({
        build: {
          outputs: [
            '{projectRoot}/../dist/mypkg',
            '{projectRoot}/other-artifacts',
          ],
        },
      });
    });

    it('should leave custom inputs, dependsOn, etc. intact', async () => {
      const project = createProject(tree, {
        name: 'mypkg',
        root: 'mypkg',
        additionalTargetProperties: {
          inputs: [
            'production',
            { env: 'CI' },
            { externalDependencies: ['rollup'] },
          ],
          dependsOn: ['^build', 'build-base'],
        },
      });

      await convertToInferred(tree, { project: project.name });

      expect(readProjectConfiguration(tree, project.name).targets).toEqual({
        build: {
          inputs: [
            'production',
            { env: 'CI' },
            { externalDependencies: ['rollup'] },
          ],
          dependsOn: ['^build', 'build-base'],
        },
      });
    });

    it('should add Rollup CLI as external dependency in inputs if not already present', async () => {
      const project1 = createProject(tree, {
        name: 'mypkg1',
        root: 'mypkg1',
        additionalTargetProperties: {
          inputs: ['production', { env: 'CI' }],
        },
      });

      const project2 = createProject(tree, {
        name: 'mypkg2',
        root: 'mypkg2',
        additionalTargetProperties: {
          inputs: [
            'production',
            { env: 'CI' },
            { externalDependencies: ['foo'] },
          ],
        },
      });

      await convertToInferred(tree, { project: project1.name });
      await convertToInferred(tree, { project: project2.name });

      expect(readProjectConfiguration(tree, project1.name).targets).toEqual({
        build: {
          inputs: [
            'production',
            { env: 'CI' },
            { externalDependencies: ['rollup'] },
          ],
        },
      });
      expect(readProjectConfiguration(tree, project2.name).targets).toEqual({
        build: {
          inputs: [
            'production',
            { env: 'CI' },
            { externalDependencies: ['foo', 'rollup'] },
          ],
        },
      });
    });

    it('should inline options from configurations into the config file', async () => {
      const project = createProject(tree, {
        name: 'mypkg',
        root: 'mypkg',
        additionalTargetProperties: {
          defaultConfiguration: 'foo',
          configurations: {
            foo: {
              watch: true,
              main: 'mypkg/src/foo.ts',
            },
            bar: {
              watch: false,
              main: 'mypkg/src/bar.ts',
            },
          },
        },
      });

      await convertToInferred(tree, { project: project.name });

      expect(tree.read('mypkg/rollup.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withNx } = require('@nx/rollup/with-nx');

        // These options were migrated by @nx/rollup:convert-to-inferred from project.json
        const configValues = {
          default: {
            main: './src/index.ts',
            outputPath: '../dist/mypkg',
            tsConfig: './tsconfig.lib.json',
            compiler: 'babel',
            format: ['esm'],
            external: [],
            assets: [],
          },
          foo: {
            main: 'mypkg/src/foo.ts',
          },
          bar: {
            main: 'mypkg/src/bar.ts',
          },
        };

        // Determine the correct configValue to use based on the configuration
        const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';

        const options = {
          ...configValues.default,
          ...configValues[nxConfiguration],
        };

        const config = withNx(options, {
          // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
          // e.g.
          // output: { sourcemap: true },
        });

        module.exports = config;
        "
      `);
      expect(readProjectConfiguration(tree, project.name).targets).toEqual({
        build: {
          configurations: {
            bar: {
              watch: false,
            },
            foo: {
              watch: true,
            },
          },
          defaultConfiguration: 'foo',
        },
      });
    });

    it('should merge targetDefaults for @nx/rollup:rollup into target options and generated config', async () => {
      const project = createProject(tree, {
        name: 'mypkg1',
        root: 'mypkg1',
        targetInputs: ['production', '^production', { env: 'CI' }],
        targetOptions: null,
      });
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/rollup:rollup': {
          cache: true,
          dependsOn: ['build-base', '^build'],
          inputs: ['production', '^production'],
          options: {
            main: './src/main.ts',
            outputPath: '../dist/mypkg1',
            tsConfig: './tsconfig.lib.json',
            compiler: 'swc',
            format: ['esm', 'cjs'],
            external: ['react', 'react-dom'],
            assets: [{ glob: 'mypkg/README.md', input: '.', output: '.' }],
          },
        },
      };
      updateNxJson(tree, nxJson);

      await convertToInferred(tree, { project: project.name });

      // Doesn't override what's already in project.json
      expect(
        readProjectConfiguration(tree, project.name).targets.build.inputs
      ).toEqual([
        'production',
        '^production',
        { externalDependencies: ['rollup'] },
      ]);
      // These properties are set since they were undefined in project.json
      expect(
        readProjectConfiguration(tree, project.name).targets.build.dependsOn
      ).toEqual(['build-base', '^build']);
      expect(
        readProjectConfiguration(tree, project.name).targets.build.cache
      ).toBe(true);
      // Plugin options are read from targetDefaults since they were missing in project.json
      expect(tree.read('mypkg1/rollup.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withNx } = require('@nx/rollup/with-nx');

        // These options were migrated by @nx/rollup:convert-to-inferred from project.json
        const options = {
          main: '../src/main.ts',
          outputPath: '../../dist/mypkg1',
          tsConfig: '../tsconfig.lib.json',
          compiler: 'swc',
          format: ['esm', 'cjs'],
          external: ['react', 'react-dom'],
          assets: [
            {
              glob: 'mypkg/README.md',
              input: '.',
              output: '.',
            },
          ],
        };

        const config = withNx(options, {
          // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
          // e.g.
          // output: { sourcemap: true },
        });

        module.exports = config;
        "
      `);
    });
  });

  describe('all projects', () => {
    it('should successfully migrate projects using Rollup executors to plugin', async () => {
      createProject(tree, {
        name: 'pkg1',
        root: 'pkg1',
      });
      createProject(tree, {
        name: 'pkg2',
        root: 'pkg2',
      });

      await convertToInferred(tree, {});

      expect(tree.read('pkg1/rollup.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withNx } = require('@nx/rollup/with-nx');

        // These options were migrated by @nx/rollup:convert-to-inferred from project.json
        const options = {
          main: './src/index.ts',
          outputPath: '../dist/pkg1',
          tsConfig: './tsconfig.lib.json',
          compiler: 'babel',
          format: ['esm'],
          external: [],
          assets: [],
        };

        const config = withNx(options, {
          // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
          // e.g.
          // output: { sourcemap: true },
        });

        module.exports = config;
        "
      `);
      expect(tree.read('pkg2/rollup.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withNx } = require('@nx/rollup/with-nx');

        // These options were migrated by @nx/rollup:convert-to-inferred from project.json
        const options = {
          main: './src/index.ts',
          outputPath: '../dist/pkg2',
          tsConfig: './tsconfig.lib.json',
          compiler: 'babel',
          format: ['esm'],
          external: [],
          assets: [],
        };

        const config = withNx(options, {
          // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
          // e.g.
          // output: { sourcemap: true },
        });

        module.exports = config;
        "
      `);
      expect(readProjectConfiguration(tree, 'pkg1').targets).toEqual({});
      expect(readProjectConfiguration(tree, 'pkg2').targets).toEqual({});
    });
  });
});
