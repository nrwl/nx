import {
  addProjectConfiguration,
  logger,
  readJson,
  readProjectConfiguration,
  updateJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { convertToApplicationExecutor } from './convert-to-application-executor';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(projectGraph)),
}));

describe('convert-to-application-executor generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = { nodes: {}, dependencies: {} };
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  it.each`
    executor                                           | expected
    ${'@angular-devkit/build-angular:browser'}         | ${'@angular-devkit/build-angular:application'}
    ${'@angular-devkit/build-angular:browser-esbuild'} | ${'@angular-devkit/build-angular:application'}
  `(
    'should replace "$executor" with "$expected" when there are "@angular-devkit/build-angular" executors not present in "@angular/build" in the same project',
    async ({ executor, expected }) => {
      addProject(tree, 'app1', {
        root: 'app1',
        projectType: 'application',
        targets: {
          build: { executor },
          test: { executor: '@angular-devkit/build-angular:karma' },
        },
      });

      await convertToApplicationExecutor(tree, {});

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.build.executor).toBe(expected);
      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['@angular/build']).toBeUndefined();
    }
  );

  it.each`
    executor                                           | expected
    ${'@angular-devkit/build-angular:browser'}         | ${'@angular-devkit/build-angular:application'}
    ${'@angular-devkit/build-angular:browser-esbuild'} | ${'@angular-devkit/build-angular:application'}
  `(
    'should replace "$executor" with "$expected" when there are "@angular-devkit/build-angular" executors not present in "@angular/build" in any projects',
    async ({ executor, expected }) => {
      addProject(tree, 'app1', {
        root: 'app1',
        projectType: 'application',
        targets: { build: { executor } },
      });
      addProject(tree, 'app2', {
        root: 'app2',
        projectType: 'application',
        targets: { test: { executor: '@angular-devkit/build-angular:karma' } },
      });

      await convertToApplicationExecutor(tree, {});

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.build.executor).toBe(expected);
      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['@angular/build']).toBeUndefined();
    }
  );

  it.each`
    buildTargetExecutor                                | expected
    ${'@angular-devkit/build-angular:browser'}         | ${'@angular/build:application'}
    ${'@angular-devkit/build-angular:browser-esbuild'} | ${'@angular/build:application'}
  `(
    'should replace "$executor" with "$expected" when there are no "@angular-devkit/build-angular" executors not present in "@angular/build" in the same project',
    async ({ buildTargetExecutor, expected }) => {
      addProject(tree, 'app1', {
        root: 'app1',
        projectType: 'application',
        targets: {
          build: { executor: buildTargetExecutor },
          serve: { executor: '@angular-devkit/build-angular:dev-server' },
          'extract-i18n': {
            executor: '@angular-devkit/build-angular:extract-i18n',
          },
        },
      });

      await convertToApplicationExecutor(tree, {});

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.build.executor).toBe(expected);
      expect(project.targets.serve.executor).toBe('@angular/build:dev-server');
      expect(project.targets['extract-i18n'].executor).toBe(
        '@angular/build:extract-i18n'
      );
      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['@angular/build']).toBeDefined();
    }
  );

  it.each`
    executor                         | expected
    ${'@nx/angular:webpack-browser'} | ${'@nx/angular:application'}
    ${'@nx/angular:browser-esbuild'} | ${'@nx/angular:application'}
  `(
    'should replace nx executor "$executor" with "$expected"',
    async ({ executor, expected }) => {
      addProject(tree, 'app1', {
        root: 'app1',
        projectType: 'application',
        targets: { build: { executor } },
      });

      await convertToApplicationExecutor(tree, {});

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.build.executor).toBe(expected);
      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['@angular/build']).toBeUndefined();
    }
  );

  it('should not convert the target when using a custom webpack config', async () => {
    addProject(tree, 'app1', {
      root: 'app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/angular:webpack-browser',
          options: {
            customWebpackConfig: {
              path: 'app1/webpack.config.js',
            },
          },
        },
      },
    });

    await convertToApplicationExecutor(tree, {});

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.executor).toBe('@nx/angular:webpack-browser');
    expect(project.targets.build.options.customWebpackConfig).toStrictEqual({
      path: 'app1/webpack.config.js',
    });
  });

  it('should rename "main" to "browser"', async () => {
    addProject(tree, 'app1', {
      root: 'app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            main: 'app1/main.ts',
          },
        },
      },
    });

    await convertToApplicationExecutor(tree, {});

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.options.browser).toBe('app1/main.ts');
    expect(project.targets.build.options.main).toBeUndefined();
  });

  it('should rename "ngswConfigPath" to "serviceWorker"', async () => {
    addProject(tree, 'app1', {
      root: 'app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            ngswConfigPath: 'app1/ngsw-config.json',
          },
        },
      },
    });

    await convertToApplicationExecutor(tree, {});

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.options.serviceWorker).toBe(
      'app1/ngsw-config.json'
    );
    expect(project.targets.build.options.ngswConfigPath).toBeUndefined();
  });

  it('should convert a string value for "polyfills" to an array', async () => {
    addProject(tree, 'app1', {
      root: 'app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            polyfills: 'zone.js',
          },
        },
      },
    });

    await convertToApplicationExecutor(tree, {});

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.options.polyfills).toStrictEqual(['zone.js']);
  });

  it('should update "outputs"', async () => {
    addProject(tree, 'app1', {
      root: 'app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          outputs: ['{options.outputPath}'],
          options: {
            outputPath: 'dist/app1',
            resourcesOutputPath: 'media',
          },
        },
      },
    });

    await convertToApplicationExecutor(tree, {});

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.outputs).toStrictEqual([
      '{options.outputPath.base}',
    ]);
  });

  it('should replace "outputPath" to string if "resourcesOutputPath" is set to "media"', async () => {
    addProject(tree, 'app1', {
      root: 'app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/app1',
            resourcesOutputPath: 'media',
          },
        },
      },
    });

    await convertToApplicationExecutor(tree, {});

    const project = readProjectConfiguration(tree, 'app1');
    const { outputPath, resourcesOutputPath } = project.targets.build.options;
    expect(outputPath).toStrictEqual({ base: 'dist/app1' });
    expect(resourcesOutputPath).toBeUndefined();
  });

  it('should set "outputPath.media" if "resourcesOutputPath" is set and is not "media"', async () => {
    addProject(tree, 'app1', {
      root: 'app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/app1',
            resourcesOutputPath: 'resources',
          },
        },
      },
    });

    await convertToApplicationExecutor(tree, {});

    const project = readProjectConfiguration(tree, 'app1');
    const { outputPath, resourcesOutputPath } = project.targets.build.options;
    expect(outputPath).toStrictEqual({ base: 'dist/app1', media: 'resources' });
    expect(resourcesOutputPath).toBeUndefined();
  });

  it('should remove "browser" portion from "outputPath"', async () => {
    addProject(tree, 'app1', {
      root: 'app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/app1/browser',
            resourcesOutputPath: 'resources',
          },
        },
      },
    });

    await convertToApplicationExecutor(tree, {});

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.options.outputPath).toStrictEqual({
      base: 'dist/app1',
      media: 'resources',
    });
  });

  it('should remove unsupported options', async () => {
    addProject(tree, 'app1', {
      root: 'app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {},
          configurations: {
            development: {
              buildOptimizer: false,
              vendorChunk: true,
              commonChunk: true,
            },
          },
        },
      },
    });

    await convertToApplicationExecutor(tree, {});

    const project = readProjectConfiguration(tree, 'app1');
    expect(
      project.targets.build.configurations.development.buildOptimizer
    ).toBeUndefined();
    expect(
      project.targets.build.configurations.development.vendorChunk
    ).toBeUndefined();
    expect(
      project.targets.build.configurations.development.commonChunk
    ).toBeUndefined();
  });

  describe('compat', () => {
    it('should not convert outputs to the object notation when angular version is lower that 17.1.0', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.dependencies['@angular/core'] = '17.0.0';
        return json;
      });
      addProject(tree, 'app1', {
        root: 'app1',
        projectType: 'application',
        targets: {
          build: {
            executor: '@angular-devkit/build-angular:browser',
            outputs: ['{options.outputPath}'],
            options: {
              outputPath: 'dist/app1',
            },
          },
        },
      });

      await convertToApplicationExecutor(tree, {});

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.build.outputs).toStrictEqual([
        '{options.outputPath}',
      ]);
      expect(project.targets.build.options.outputPath).toBe('dist/app1');
    });

    it('should remove trailing "/browser" from output path when angular version is lower that 17.1.0', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.dependencies['@angular/core'] = '17.0.0';
        return json;
      });
      addProject(tree, 'app1', {
        root: 'app1',
        projectType: 'application',
        targets: {
          build: {
            executor: '@angular-devkit/build-angular:browser',
            outputs: ['{options.outputPath}'],
            options: {
              outputPath: 'dist/app1/browser',
            },
          },
        },
      });

      await convertToApplicationExecutor(tree, {});

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.build.outputs).toStrictEqual([
        '{options.outputPath}',
      ]);
      expect(project.targets.build.options.outputPath).toBe('dist/app1');
    });

    it('should not use "@angular/build" when angular version is lower that 18.0.0', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.dependencies['@angular/core'] = '17.0.0';
        return json;
      });
      addProject(tree, 'app1', {
        root: 'app1',
        projectType: 'application',
        targets: {
          build: { executor: '@angular-devkit/build-angular:browser' },
        },
      });

      await convertToApplicationExecutor(tree, {});

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.build.executor).toBe(
        '@angular-devkit/build-angular:application'
      );
      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['@angular/build']).toBeUndefined();
    });
  });
});

function addProject(
  tree: Tree,
  projectName: string,
  config: ProjectConfiguration
): void {
  addProjectConfiguration(tree, projectName, config);

  projectGraph.nodes[projectName] = {
    name: projectName,
    type: config.projectType === 'application' ? 'app' : 'lib',
    data: config,
  };
  projectGraph.dependencies[projectName] = [
    { source: projectName, target: 'npm:@angular/core', type: 'static' },
  ];
}
