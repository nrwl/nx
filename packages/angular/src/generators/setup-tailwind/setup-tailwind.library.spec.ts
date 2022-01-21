import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { setupTailwindGenerator } from './setup-tailwind';
import {
  autoprefixerVersion,
  postcssVersion,
  tailwindVersion,
} from '../../utils/versions';

describe('setupTailwind generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
    jest.clearAllMocks();
  });

  it('should fail when the project does not exist', async () => {
    await expect(
      setupTailwindGenerator(tree, { project: 'not-found' })
    ).rejects.toThrow();
  });

  describe('libraries', () => {
    const project = 'lib1';

    beforeEach(() => {
      addProjectConfiguration(tree, project, {
        name: project,
        projectType: 'library',
        root: `libs/${project}`,
        sourceRoot: `libs/${project}/src`,
      });
    });

    it('should throw when tailwind is installed as a dependency with a version lower than 2.0.0', async () => {
      tree.write(
        'package.json',
        JSON.stringify({ dependencies: { tailwindcss: '^1.99.99' } })
      );

      await expect(setupTailwindGenerator(tree, { project })).rejects.toThrow(
        `Tailwind CSS version "^1.99.99" is not supported. Please upgrade to v2.0.0 or higher.`
      );
    });

    it('should throw when tailwind is installed as a devDependency with a version lower than 2.0.0', async () => {
      tree.write(
        'package.json',
        JSON.stringify({ devDependencies: { tailwindcss: '^1.99.99' } })
      );

      await expect(setupTailwindGenerator(tree, { project })).rejects.toThrow(
        `Tailwind CSS version "^1.99.99" is not supported. Please upgrade to v2.0.0 or higher.`
      );
    });

    it('should throw when the build target is not found', async () => {
      await expect(setupTailwindGenerator(tree, { project })).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            `The target "build" was not found for project "${project}".`
          ),
        })
      );
    });

    it('should throw when the specified build target is not found', async () => {
      await expect(
        setupTailwindGenerator(tree, { project, buildTarget: 'custom-build' })
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            `The target "custom-build" was not found for project "${project}".`
          ),
        })
      );
    });

    it('should throw when the build target is using an unsupported executor', async () => {
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: {
          executor: '@angular/build-angular:browser',
          options: {},
        },
      };
      updateProjectConfiguration(tree, project, projectConfig);

      await expect(setupTailwindGenerator(tree, { project })).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            `The build target for project "${project}" is using an unsupported executor "@angular/build-angular:browser".`
          ),
        })
      );
    });

    it('should throw when the tailwind config is configured in the build target and the file it points to exists', async () => {
      const tailwindConfig = `libs/${project}/my-tailwind.config.js`;
      let projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: {
          executor: '@nrwl/angular:package',
          options: { tailwindConfig },
        },
      };
      updateProjectConfiguration(tree, project, projectConfig);
      tree.write(tailwindConfig, '');

      await expect(setupTailwindGenerator(tree, { project })).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            `The "${tailwindConfig}" file is already configured for the project "${project}". Are you sure this is the right project to set up Tailwind?`
          ),
        })
      );
    });

    it('should add the tailwind config path to the "build" target by default when no build target is specified', async () => {
      let projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: { executor: '@nrwl/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);

      await setupTailwindGenerator(tree, { project });

      projectConfig = readProjectConfiguration(tree, project);
      expect(projectConfig.targets.build.options.tailwindConfig).toBe(
        `libs/${project}/tailwind.config.js`
      );
    });

    it('should add the tailwind config path to the specified buildTarget', async () => {
      const buildTarget = 'custom-build';
      let projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        [buildTarget]: { executor: '@nrwl/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);

      await setupTailwindGenerator(tree, { project, buildTarget });

      projectConfig = readProjectConfiguration(tree, project);
      expect(projectConfig.targets[buildTarget].options.tailwindConfig).toBe(
        `libs/${project}/tailwind.config.js`
      );
    });

    it.each(['@nrwl/angular:ng-packagr-lite', '@nrwl/angular:package'])(
      'should add the tailwind config path when using the "%s" executor',
      async (executor) => {
        let projectConfig = readProjectConfiguration(tree, project);
        projectConfig.targets = { build: { executor, options: {} } };
        updateProjectConfiguration(tree, project, projectConfig);

        await setupTailwindGenerator(tree, { project });

        projectConfig = readProjectConfiguration(tree, project);
        expect(projectConfig.targets.build.options.tailwindConfig).toBe(
          `libs/${project}/tailwind.config.js`
        );
      }
    );

    it('should add required packages', async () => {
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: { executor: '@nrwl/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);

      await setupTailwindGenerator(tree, { project });

      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies.tailwindcss).toBe(tailwindVersion);
      expect(devDependencies.autoprefixer).toBe(autoprefixerVersion);
      expect(devDependencies.postcss).toBe(postcssVersion);
    });

    it('should generate the tailwind.config.js file in the project root for v3 by default', async () => {
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: { executor: '@nrwl/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);

      await setupTailwindGenerator(tree, { project });

      expect(tree.read(`libs/${project}/tailwind.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
        const { join } = require('path');

        module.exports = {
          content: [
            join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
            ...createGlobPatternsForDependencies(__dirname),
          ],
          theme: {
            extend: {},
          },
          plugins: [],
        };
        "
      `);
    });

    it('should generate the tailwind.config.js file in the project root with the config for v3 when a version greater than 3 is installed', async () => {
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: { executor: '@nrwl/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);
      tree.write(
        'package.json',
        JSON.stringify({ devDependencies: { tailwindcss: '^3.0.1' } })
      );

      await setupTailwindGenerator(tree, { project });

      expect(tree.read(`libs/${project}/tailwind.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
        const { join } = require('path');

        module.exports = {
          content: [
            join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
            ...createGlobPatternsForDependencies(__dirname),
          ],
          theme: {
            extend: {},
          },
          plugins: [],
        };
        "
      `);
    });

    it('should generate the tailwind.config.js file in the project root with the config for v2 when a version greater than 2 and lower than 3 is installed', async () => {
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: { executor: '@nrwl/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);
      tree.write(
        'package.json',
        JSON.stringify({ devDependencies: { tailwindcss: '~2.0.0' } })
      );

      await setupTailwindGenerator(tree, { project });

      expect(tree.read(`libs/${project}/tailwind.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
        const { join } = require('path');

        module.exports = {
          mode: 'jit',
          purge: [
            join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
            ...createGlobPatternsForDependencies(__dirname),
          ],
          darkMode: false, // or 'media' or 'class'
          theme: {
            extend: {},
          },
          variants: {
            extend: {},
          },
          plugins: [],
        };
        "
      `);
    });

    it('should format files', async () => {
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: { executor: '@nrwl/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);
      jest.spyOn(devkit, 'formatFiles');

      await setupTailwindGenerator(tree, { project });

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when "skipFormat: true"', async () => {
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: { executor: '@nrwl/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);
      jest.spyOn(devkit, 'formatFiles');

      await setupTailwindGenerator(tree, { project, skipFormat: true });

      expect(devkit.formatFiles).not.toHaveBeenCalled();
    });
  });
});
