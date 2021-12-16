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

    it('should throw when there is a tailwind.config.js file in the project', async () => {
      tree.write(`apps/${project}/tailwind.config.js`, '');

      await expect(setupTailwindGenerator(tree, { project })).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            `The "tailwind.config.js" file already exists in the project "${project}". Are you sure this is the right project to set up Tailwind?`
          ),
        })
      );
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

    it('should generate the tailwind.config.js file in the project root with the config for v3 by default', async () => {
      const stylesEntryPoint = `apps/${project}/src/styles.scss`;
      tree.write(stylesEntryPoint, 'p { margin: 0; }');

      await setupTailwindGenerator(tree, { project, stylesEntryPoint });

      expect(tree.read(`apps/${project}/tailwind.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
        const { join } = require('path');

        module.exports = {
          content: [
            join(__dirname, 'src/**/*.{html,ts}'),
            ...createGlobPatternsForDependencies(__dirname),
          ],
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

    it('should generate the tailwind.config.js file in the project root with the config for v3 when a version greater than 3 is installed', async () => {
      const stylesEntryPoint = `apps/${project}/src/styles.scss`;
      tree.write(stylesEntryPoint, 'p { margin: 0; }');
      tree.write(
        'package.json',
        JSON.stringify({ devDependencies: { tailwindcss: '^3.0.1' } })
      );

      await setupTailwindGenerator(tree, { project, stylesEntryPoint });

      expect(tree.read(`apps/${project}/tailwind.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
        const { join } = require('path');

        module.exports = {
          content: [
            join(__dirname, 'src/**/*.{html,ts}'),
            ...createGlobPatternsForDependencies(__dirname),
          ],
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

    it('should generate the tailwind.config.js file in the project root with the config for v2 when a version greater than 2 and lower than 3 is installed', async () => {
      const stylesEntryPoint = `apps/${project}/src/styles.scss`;
      tree.write(stylesEntryPoint, 'p { margin: 0; }');
      tree.write(
        'package.json',
        JSON.stringify({ devDependencies: { tailwindcss: '~2.0.0' } })
      );

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
});
