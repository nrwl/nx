import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { webStaticServeGenerator } from './static-serve-configuration';

describe('Static serve configuration generator', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add a `serve-static` target to the project', async () => {
    addReactConfig(tree, 'react-app');
    addAngularConfig(tree, 'angular-app');
    addStorybookConfig(tree, 'storybook');

    await webStaticServeGenerator(tree, {
      buildTarget: 'react-app:build',
    });

    expect(readProjectConfiguration(tree, 'react-app').targets['serve-static'])
      .toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "build",
        ],
        "executor": "@nx/web:file-server",
        "options": {
          "buildTarget": "react-app:build",
          "spa": true,
        },
      }
    `);
    await webStaticServeGenerator(tree, {
      buildTarget: 'angular-app:build',
    });

    expect(
      readProjectConfiguration(tree, 'angular-app').targets['serve-static']
    ).toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "build",
        ],
        "executor": "@nx/web:file-server",
        "options": {
          "buildTarget": "angular-app:build",
          "spa": true,
        },
      }
    `);

    await webStaticServeGenerator(tree, {
      buildTarget: 'storybook:build-storybook',
    });
    expect(readProjectConfiguration(tree, 'storybook').targets['serve-static'])
      .toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "build-storybook",
        ],
        "executor": "@nx/web:file-server",
        "options": {
          "buildTarget": "storybook:build-storybook",
          "spa": true,
          "staticFilePath": "dist/storybook/storybook",
        },
      }
    `);
  });

  it('should support custom target name', async () => {
    addReactConfig(tree, 'react-app');
    await webStaticServeGenerator(tree, {
      buildTarget: 'react-app:build',
      targetName: 'serve-static-custom',
    });

    expect(
      readProjectConfiguration(tree, 'react-app').targets['serve-static-custom']
    ).toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "build",
        ],
        "executor": "@nx/web:file-server",
        "options": {
          "buildTarget": "react-app:build",
          "spa": true,
        },
      }
    `);
  });

  it('should infer outputPath via the buildTarget#outputs', async () => {
    addAngularConfig(tree, 'angular-app');
    const projectConfig = readProjectConfiguration(tree, 'angular-app');
    delete projectConfig.targets.build.options.outputPath;
    projectConfig.targets.build.outputs = ['{options.myPath}'];
    projectConfig.targets.build.options.myPath = 'dist/angular-app';

    updateProjectConfiguration(tree, 'angular-app', projectConfig);

    await webStaticServeGenerator(tree, {
      buildTarget: 'angular-app:build',
    });

    expect(
      readProjectConfiguration(tree, 'angular-app').targets['serve-static']
    ).toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "build",
        ],
        "executor": "@nx/web:file-server",
        "options": {
          "buildTarget": "angular-app:build",
          "spa": true,
          "staticFilePath": "dist/angular-app",
        },
      }
    `);
  });

  it('should not override targets', async () => {
    addStorybookConfig(tree, 'storybook');

    const pc = readProjectConfiguration(tree, 'storybook');
    pc.targets['serve-static'] = {
      executor: 'custom:executor',
    };

    updateProjectConfiguration(tree, 'storybook', pc);

    expect(() => {
      return webStaticServeGenerator(tree, {
        buildTarget: 'storybook:build-storybook',
      });
    }).rejects.toThrowErrorMatchingInlineSnapshot(`
      "Project storybook already has a 'serve-static' target configured.
      Either rename or remove the existing 'serve-static' target and try again.
      Optionally, you can provide a different name with the --target-name option other than 'serve-static'"
    `);
  });
});

function addReactConfig(tree: Tree, name: string) {
  addProjectConfiguration(tree, name, {
    name,
    projectType: 'application',
    root: `${name}`,
    sourceRoot: `${name}/src`,
    targets: {
      build: {
        executor: '@nx/vite:build',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: {
          outputPath: `dist/${name}`,
        },
        configurations: {
          development: {
            mode: 'development',
          },
          production: {
            mode: 'production',
          },
        },
      },
    },
  });
}

function addAngularConfig(tree: Tree, name: string) {
  addProjectConfiguration(tree, name, {
    name,
    projectType: 'application',
    root: `${name}`,
    sourceRoot: `${name}/src`,
    targets: {
      build: {
        executor: '@angular-devkit/build-angular:browser',
        outputs: ['{options.outputPath}'],
        options: {
          outputPath: `dist/${name}`,
          index: `${name}/src/index.html`,
          main: `${name}/src/main.ts`,
          polyfills: [`zone.js`],
          tsConfig: `${name}/tsconfig.app.json`,
          inlineStyleLanguage: `scss`,
          assets: [`${name}/src/favicon.ico`, `${name}/src/assets`],
          styles: [`${name}/src/styles.scss`],
          scripts: [],
        },
      },
    },
  });
}

function addStorybookConfig(tree: Tree, name: string) {
  addProjectConfiguration(tree, name, {
    name,
    projectType: 'application',
    root: `${name}`,
    sourceRoot: `${name}/src`,
    targets: {
      'build-storybook': {
        executor: '@storybook/angular:build-storybook',
        outputs: ['{options.outputDir}'],
        options: {
          outputDir: `dist/${name}/storybook`,
          configDir: `${name}/.storybook`,
          browserTarget: `storybook:build-storybook`,
          compodoc: false,
        },
        configurations: {
          ci: {
            quiet: true,
          },
        },
      },
    },
  });
}
