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

  it('should fail if the project does not exist', async () => {
    await expect(
      setupTailwindGenerator(tree, { project: 'not-found' })
    ).rejects.toThrow();
  });

  describe('application', () => {
    const project = 'app1';

    beforeEach(() => {
      addProjectConfiguration(tree, project, {
        name: project,
        projectType: 'application',
        root: `apps/${project}`,
        sourceRoot: `apps/${project}/src`,
      });
    });

    it('should throw when the provided styles entry point is not found', async () => {
      const stylesEntryPoint = `apps/${project}/src/foo.scss`;

      await expect(
        setupTailwindGenerator(tree, { project, stylesEntryPoint })
      ).rejects.toThrow(
        `The provided styles entry point "${stylesEntryPoint}" could not be found.`
      );
    });

    it('should throw when the styles entry point is not provided and it is not found', async () => {
      await expect(setupTailwindGenerator(tree, { project })).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            `Could not find a styles entry point for project "${project}"`
          ),
        })
      );
    });

    it('should throw when styles is not configured in the build config', async () => {
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {},
        },
      };

      await expect(setupTailwindGenerator(tree, { project })).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            `Could not find a styles entry point for project "${project}"`
          ),
        })
      );
    });

    it('should throw when the styles configured in the build config do not exist', async () => {
      const stylesEntryPoint = `apps/${project}/src/custom-styles-entry-point.scss`;
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            styles: ['node_modules/awesome-ds/styles.css', stylesEntryPoint],
          },
        },
      };

      await expect(setupTailwindGenerator(tree, { project })).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            `Could not find a styles entry point for project "${project}"`
          ),
        })
      );
    });

    it('should throw when no styles within the project root are configured in the build config', async () => {
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            styles: ['node_modules/awesome-ds/styles.css'],
          },
        },
      };

      await expect(setupTailwindGenerator(tree, { project })).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            `Could not find a styles entry point for project "${project}"`
          ),
        })
      );
    });

    it('should throw when the style inside the project root specified in the build config as an object has "inject: false"', async () => {
      const stylesEntryPoint = `apps/${project}/src/custom-styles-entry-point.scss`;
      tree.write(stylesEntryPoint, 'p { margin: 0; }');
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            styles: [
              'node_modules/awesome-ds/styles.css',
              {
                bundleName: 'styles.css',
                input: stylesEntryPoint,
                inject: false,
              },
            ],
          },
        },
      };
      updateProjectConfiguration(tree, project, projectConfig);

      await expect(setupTailwindGenerator(tree, { project })).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            `Could not find a styles entry point for project "${project}"`
          ),
        })
      );
    });

    it('should add tailwind styles to provided styles entry point', async () => {
      const stylesEntryPoint = `apps/${project}/src/custom-styles-entry-point.scss`;
      tree.write(stylesEntryPoint, 'p { margin: 0; }');

      await setupTailwindGenerator(tree, { project, stylesEntryPoint });

      expect(tree.read(stylesEntryPoint, 'utf-8')).toMatchInlineSnapshot(`
        "@tailwind base;
        @tailwind components;
        @tailwind utilities;

        p { margin: 0; }"
      `);
    });

    it.each([
      `apps/${project}/src/styles.css`,
      `apps/${project}/src/styles.scss`,
      `apps/${project}/src/styles.sass`,
      `apps/${project}/src/styles.less`,
    ])(
      'should add tailwind styles to "%s" when not provided',
      async (stylesEntryPoint) => {
        tree.write(stylesEntryPoint, 'p { margin: 0; }');

        await setupTailwindGenerator(tree, { project });

        expect(tree.read(stylesEntryPoint, 'utf-8')).toMatchInlineSnapshot(`
                  "@tailwind base;
                  @tailwind components;
                  @tailwind utilities;

                  p { margin: 0; }"
              `);
      }
    );

    it('should add tailwind styles to the first style inside the project root specified in the build config as a string', async () => {
      const stylesEntryPoint = `apps/${project}/src/custom-styles-entry-point.scss`;
      tree.write(stylesEntryPoint, 'p { margin: 0; }');
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            styles: ['node_modules/awesome-ds/styles.css', stylesEntryPoint],
          },
        },
      };
      updateProjectConfiguration(tree, project, projectConfig);

      await setupTailwindGenerator(tree, { project });

      expect(tree.read(stylesEntryPoint, 'utf-8')).toMatchInlineSnapshot(`
        "@tailwind base;
        @tailwind components;
        @tailwind utilities;

        p { margin: 0; }"
      `);
    });

    it('should add tailwind styles to the first style inside the project root specified in the build config as an object when inject is not specified', async () => {
      const stylesEntryPoint = `apps/${project}/src/custom-styles-entry-point.scss`;
      tree.write(stylesEntryPoint, 'p { margin: 0; }');
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            styles: [
              'node_modules/awesome-ds/styles.css',
              {
                bundleName: 'styles.css',
                input: stylesEntryPoint,
              },
            ],
          },
        },
      };
      updateProjectConfiguration(tree, project, projectConfig);

      await setupTailwindGenerator(tree, { project });

      expect(tree.read(stylesEntryPoint, 'utf-8')).toMatchInlineSnapshot(`
        "@tailwind base;
        @tailwind components;
        @tailwind utilities;

        p { margin: 0; }"
      `);
    });

    it('should add tailwind styles to the first style inside the project root specified in the build config as an object when "inject: true"', async () => {
      const stylesEntryPoint = `apps/${project}/src/custom-styles-entry-point.scss`;
      tree.write(stylesEntryPoint, 'p { margin: 0; }');
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            styles: [
              'node_modules/awesome-ds/styles.css',
              {
                bundleName: 'styles.css',
                input: stylesEntryPoint,
                inject: true,
              },
            ],
          },
        },
      };
      updateProjectConfiguration(tree, project, projectConfig);

      await setupTailwindGenerator(tree, { project });

      expect(tree.read(stylesEntryPoint, 'utf-8')).toMatchInlineSnapshot(`
        "@tailwind base;
        @tailwind components;
        @tailwind utilities;

        p { margin: 0; }"
      `);
    });

    it('should add required packages', async () => {
      const stylesEntryPoint = `apps/${project}/src/styles.scss`;
      tree.write(stylesEntryPoint, 'p { margin: 0; }');

      await setupTailwindGenerator(tree, { project, stylesEntryPoint });

      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies.tailwindcss).toBe(tailwindVersion);
      expect(devDependencies.autoprefixer).toBe(autoprefixerVersion);
      expect(devDependencies.postcss).toBe(postcssVersion);
    });

    it('should generate the tailwind.config.js file in the project root', async () => {
      const stylesEntryPoint = `apps/${project}/src/styles.scss`;
      tree.write(stylesEntryPoint, 'p { margin: 0; }');

      await setupTailwindGenerator(tree, { project, stylesEntryPoint });

      expect(tree.read(`apps/${project}/tailwind.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
        const { join } = require('path');

        module.exports = {
          mode: 'jit',
          purge: [
            join(__dirname, 'src/**/*.{html,ts}'),
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
      const stylesEntryPoint = `apps/${project}/src/styles.scss`;
      tree.write(stylesEntryPoint, 'p { margin: 0; }');
      jest.spyOn(devkit, 'formatFiles');

      await setupTailwindGenerator(tree, { project, stylesEntryPoint });

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when "skipFormat: true"', async () => {
      const stylesEntryPoint = `apps/${project}/src/styles.scss`;
      tree.write(stylesEntryPoint, 'p { margin: 0; }');
      jest.spyOn(devkit, 'formatFiles');

      await setupTailwindGenerator(tree, {
        project,
        stylesEntryPoint,
        skipFormat: true,
      });

      expect(devkit.formatFiles).not.toHaveBeenCalled();
    });
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

    it('should generate the tailwind.config.js file in the project root', async () => {
      const projectConfig = readProjectConfiguration(tree, project);
      projectConfig.targets = {
        build: { executor: '@nrwl/angular:package', options: {} },
      };
      updateProjectConfiguration(tree, project, projectConfig);

      await setupTailwindGenerator(tree, { project });

      expect(tree.read(`libs/${project}/tailwind.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "module.exports = {
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
