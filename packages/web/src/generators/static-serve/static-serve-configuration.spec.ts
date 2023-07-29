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
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add a `serve-static` target to the project', () => {
    addReactConfig(tree, 'react-app');
    addAngularConfig(tree, 'angular-app');
    addStorybookConfig(tree, 'storybook');

    webStaticServeGenerator(tree, {
      buildTarget: 'react-app:build',
    });

    expect(readProjectConfiguration(tree, 'react-app').targets['serve-static'])
      .toMatchInlineSnapshot(`
      {
        "executor": "@nx/web:file-server",
        "options": {
          "buildTarget": "react-app:build",
        },
      }
    `);
    webStaticServeGenerator(tree, {
      buildTarget: 'angular-app:build',
    });

    expect(
      readProjectConfiguration(tree, 'angular-app').targets['serve-static']
    ).toMatchInlineSnapshot(`
      {
        "executor": "@nx/web:file-server",
        "options": {
          "buildTarget": "angular-app:build",
        },
      }
    `);

    webStaticServeGenerator(tree, {
      buildTarget: 'storybook:build-storybook',
    });
    expect(readProjectConfiguration(tree, 'storybook').targets['serve-static'])
      .toMatchInlineSnapshot(`
      {
        "executor": "@nx/web:file-server",
        "options": {
          "buildTarget": "storybook:build-storybook",
          "staticFilePath": "dist/apps/storybook/storybook",
        },
      }
    `);
  });

  it('should support custom target name', () => {
    addReactConfig(tree, 'react-app');
    webStaticServeGenerator(tree, {
      buildTarget: 'react-app:build',
      targetName: 'serve-static-custom',
    });

    expect(
      readProjectConfiguration(tree, 'react-app').targets['serve-static-custom']
    ).toMatchInlineSnapshot(`
      {
        "executor": "@nx/web:file-server",
        "options": {
          "buildTarget": "react-app:build",
        },
      }
    `);
  });

  it('should infer outputPath via the buildTarget#outputs', () => {
    addAngularConfig(tree, 'angular-app');
    const projectConfig = readProjectConfiguration(tree, 'angular-app');
    delete projectConfig.targets.build.options.outputPath;
    projectConfig.targets.build.outputs = ['{options.myPath}'];
    projectConfig.targets.build.options.myPath = 'dist/apps/angular-app';

    updateProjectConfiguration(tree, 'angular-app', projectConfig);

    webStaticServeGenerator(tree, {
      buildTarget: 'angular-app:build',
    });

    expect(
      readProjectConfiguration(tree, 'angular-app').targets['serve-static']
    ).toMatchInlineSnapshot(`
      {
        "executor": "@nx/web:file-server",
        "options": {
          "buildTarget": "angular-app:build",
          "staticFilePath": "dist/apps/angular-app",
        },
      }
    `);
  });

  it('should not override targets', () => {
    addStorybookConfig(tree, 'storybook');

    const pc = readProjectConfiguration(tree, 'storybook');
    pc.targets['serve-static'] = {
      executor: 'custom:executor',
    };

    updateProjectConfiguration(tree, 'storybook', pc);

    expect(() => {
      webStaticServeGenerator(tree, {
        buildTarget: 'storybook:build-storybook',
      });
    }).toThrowErrorMatchingInlineSnapshot(`
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
    root: `apps/${name}`,
    sourceRoot: `apps/${name}/src`,
    targets: {
      build: {
        executor: '@nx/vite:build',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: {
          outputPath: `dist/apps/${name}`,
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
    root: `apps/${name}`,
    sourceRoot: `apps/${name}/src`,
    targets: {
      build: {
        executor: '@angular-devkit/build-angular:browser',
        outputs: ['{options.outputPath}'],
        options: {
          outputPath: `dist/apps/${name}`,
          index: `apps/${name}/src/index.html`,
          main: `apps/${name}/src/main.ts`,
          polyfills: [`zone.js`],
          tsConfig: `apps/${name}/tsconfig.app.json`,
          inlineStyleLanguage: `scss`,
          assets: [`apps/${name}/src/favicon.ico`, `apps/${name}/src/assets`],
          styles: [`apps/${name}/src/styles.scss`],
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
    root: `apps/${name}`,
    sourceRoot: `apps/${name}/src`,
    targets: {
      'build-storybook': {
        executor: '@storybook/angular:build-storybook',
        outputs: ['{options.outputDir}'],
        options: {
          outputDir: `dist/apps/${name}/storybook`,
          configDir: `apps/${name}/.storybook`,
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
