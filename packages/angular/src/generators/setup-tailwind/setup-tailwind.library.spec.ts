import * as devkit from '@nx/devkit';
import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { setupTailwindGenerator } from './setup-tailwind';
import {
  autoprefixerVersion,
  postcssVersion,
  tailwindVersion,
} from '../../utils/versions';

describe('setupTailwind generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
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
            `The provided target "custom-build" was not found for project "${project}".`
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

    it('should add required packages', async () => {
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: { executor: '@nx/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);

      await setupTailwindGenerator(tree, { project, skipFormat: true });

      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies.tailwindcss).toBe(tailwindVersion);
      expect(devDependencies.autoprefixer).toBe(autoprefixerVersion);
      expect(devDependencies.postcss).toBe(postcssVersion);
    });

    it('should generate the tailwind.config.js file in the project root for v3 by default', async () => {
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: { executor: '@nx/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);

      await setupTailwindGenerator(tree, { project, skipFormat: true });

      expect(tree.read(`libs/${project}/tailwind.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
        const { join } = require('path');

        /** @type {import('tailwindcss').Config} */
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
        build: { executor: '@nx/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);
      tree.write(
        'package.json',
        JSON.stringify({ devDependencies: { tailwindcss: '^3.0.1' } })
      );

      await setupTailwindGenerator(tree, { project, skipFormat: true });

      expect(tree.read(`libs/${project}/tailwind.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
        const { join } = require('path');

        /** @type {import('tailwindcss').Config} */
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
        build: { executor: '@nx/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);
      tree.write(
        'package.json',
        JSON.stringify({ devDependencies: { tailwindcss: '~2.0.0' } })
      );

      await setupTailwindGenerator(tree, { project, skipFormat: true });

      expect(tree.read(`libs/${project}/tailwind.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
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
        build: { executor: '@nx/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);
      jest.spyOn(devkit, 'formatFiles');

      await setupTailwindGenerator(tree, { project });

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when "skipFormat: true"', async () => {
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: { executor: '@nx/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);
      jest.spyOn(devkit, 'formatFiles');

      await setupTailwindGenerator(tree, { project, skipFormat: true });

      expect(devkit.formatFiles).not.toHaveBeenCalled();
    });
  });
});
