import {
  apply,
  chain,
  mergeWith,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
  noop,
  filter,
} from '@angular-devkit/schematics';
import { join, normalize } from '@angular-devkit/core';
import { Schema } from './schema';
import {
  angularCliVersion,
  nxVersion,
  prettierVersion,
} from '../../utils/versions';
import { from } from 'rxjs';
import { mapTo, tap } from 'rxjs/operators';
import {
  offsetFromRoot,
  readJsonInTree,
  resolveUserExistingPrettierConfig,
  serializeJson,
  toFileName,
  updateJsonInTree,
  getWorkspacePath,
  renameSyncInTree,
  renameDirSyncInTree,
  addInstallTask,
  addDepsToPackageJson,
} from '@nrwl/workspace';
import { DEFAULT_NRWL_PRETTIER_CONFIG } from '../workspace/workspace';
import { JsonArray } from '@angular-devkit/core';
import { updateWorkspace } from '../../utils/workspace';
import { basename, join as pathJoin } from 'path';
import { readFileSync } from 'fs';

function updatePackageJson() {
  return updateJsonInTree('package.json', (packageJson) => {
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts = {
      ...packageJson.scripts,
      nx: 'nx',
      'affected:apps': 'nx affected:apps',
      'affected:libs': 'nx affected:libs',
      'affected:build': 'nx affected:build',
      'affected:e2e': 'nx affected:e2e',
      'affected:test': 'nx affected:test',
      'affected:lint': 'nx affected:lint',
      'affected:dep-graph': 'nx affected:dep-graph',
      affected: 'nx affected',
      format: 'nx format:write',
      'format:write': 'nx format:write',
      'format:check': 'nx format:check',
      update: 'ng update @nrwl/workspace',
      'update:check': 'ng update',
      lint: 'nx workspace-lint && ng lint',
      'dep-graph': 'nx dep-graph',
      'workspace-schematic': 'nx workspace-schematic',
      help: 'nx help',
    };
    packageJson.devDependencies = packageJson.devDependencies || {};
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    if (!packageJson.dependencies['@nrwl/angular']) {
      packageJson.dependencies['@nrwl/angular'] = nxVersion;
    }
    if (!packageJson.devDependencies['@nrwl/workspace']) {
      packageJson.devDependencies['@nrwl/workspace'] = nxVersion;
    }
    if (!packageJson.devDependencies['@angular/cli']) {
      packageJson.devDependencies['@angular/cli'] = angularCliVersion;
    }
    if (!packageJson.devDependencies['prettier']) {
      packageJson.devDependencies['prettier'] = prettierVersion;
    }

    return packageJson;
  });
}

function convertPath(name: string, originalPath: string) {
  return `apps/${name}/${originalPath}`;
}

function updateAngularCLIJson(options: Schema): Rule {
  return updateWorkspace((workspace) => {
    const appName: string = workspace.extensions.defaultProject as string;
    const e2eName = appName + '-e2e';
    const e2eRoot = join(normalize('apps'), e2eName);
    workspace.extensions.newProjectRoot = '';
    const defaultProject = workspace.projects.get(appName);

    const oldSourceRoot = defaultProject.sourceRoot;
    const newRoot = join(normalize('apps'), appName);
    defaultProject.root = newRoot;
    defaultProject.sourceRoot = join(newRoot, 'src');

    function convertBuildOptions(buildOptions) {
      buildOptions.outputPath =
        buildOptions.outputPath && join(normalize('dist'), 'apps', appName);
      buildOptions.index =
        buildOptions.index && convertAsset(buildOptions.index as string);
      buildOptions.main =
        buildOptions.main && convertAsset(buildOptions.main as string);
      buildOptions.polyfills =
        buildOptions.polyfills &&
        convertAsset(buildOptions.polyfills as string);
      buildOptions.tsConfig =
        buildOptions.tsConfig && join(newRoot, 'tsconfig.app.json');
      buildOptions.assets =
        buildOptions.assets &&
        (buildOptions.assets as JsonArray).map(convertAsset);
      buildOptions.styles =
        buildOptions.styles &&
        (buildOptions.styles as JsonArray).map(convertAsset);
      buildOptions.scripts =
        buildOptions.scripts &&
        (buildOptions.scripts as JsonArray).map(convertAsset);
      buildOptions.fileReplacements =
        buildOptions.fileReplacements &&
        buildOptions.fileReplacements.map((replacement) => ({
          replace: convertAsset(replacement.replace),
          with: convertAsset(replacement.with),
        }));
    }

    convertBuildOptions(defaultProject.targets.get('build').options);
    Object.values(
      defaultProject.targets.get('build').configurations
    ).forEach((config) => convertBuildOptions(config));

    if (defaultProject.targets.has('test')) {
      const testOptions = defaultProject.targets.get('test').options;
      testOptions.main = testOptions.main && convertAsset(testOptions.main);
      testOptions.polyfills =
        testOptions.polyfills && convertAsset(testOptions.polyfills);
      testOptions.tsConfig = join(newRoot, 'tsconfig.spec.json');
      testOptions.karmaConfig = join(newRoot, 'karma.conf.js');
      testOptions.assets =
        testOptions.assets &&
        (testOptions.assets as JsonArray).map(convertAsset);
      testOptions.styles =
        testOptions.styles &&
        (testOptions.styles as JsonArray).map(convertAsset);
      testOptions.scripts =
        testOptions.scripts &&
        (testOptions.scripts as JsonArray).map(convertAsset);
    }

    const lintTarget = defaultProject.targets.get('lint');

    if (lintTarget) {
      lintTarget.options.tsConfig = [
        join(newRoot, 'tsconfig.app.json'),
        join(newRoot, 'tsconfig.spec.json'),
      ];
    }

    function convertServerOptions(serverOptions) {
      serverOptions.outputPath =
        serverOptions.outputPath &&
        join(normalize('dist'), 'apps', options.name + '-server');
      serverOptions.main =
        serverOptions.main && convertAsset(serverOptions.main);
      serverOptions.tsConfig =
        serverOptions.tsConfig &&
        join(normalize('apps'), appName, 'tsconfig.server.json');
      serverOptions.fileReplacements =
        serverOptions.fileReplacements &&
        serverOptions.fileReplacements.map((replacement) => ({
          replace: convertAsset(replacement.replace),
          with: convertAsset(replacement.with),
        }));
    }

    if (defaultProject.targets.has('server')) {
      const serverOptions = defaultProject.targets.get('server').options;
      convertServerOptions(serverOptions);
      Object.values(
        defaultProject.targets.get('server').configurations
      ).forEach((config) => convertServerOptions(config));
    }

    function convertAsset(asset: string | any) {
      if (typeof asset === 'string') {
        return asset.startsWith(oldSourceRoot)
          ? convertPath(appName, asset)
          : asset;
      } else {
        return {
          ...asset,
          input:
            asset.input && asset.input.startsWith(oldSourceRoot)
              ? convertPath(appName, asset.input)
              : asset.input,
        };
      }
    }

    if (defaultProject.targets.get('e2e')) {
      const lintTargetOptions = lintTarget ? lintTarget.options : {};
      const e2eProject = workspace.projects.add({
        name: e2eName,
        root: e2eRoot,
        projectType: 'application',
        targets: {
          e2e: defaultProject.targets.get('e2e'),
        },
      });
      e2eProject.targets.add({
        name: 'lint',
        builder: '@angular-devkit/build-angular:tslint',
        options: {
          ...lintTargetOptions,
          tsConfig: join(e2eRoot, 'tsconfig.json'),
        },
      });
      e2eProject.targets.get('e2e').options.protractorConfig = join(
        e2eRoot,
        'protractor.conf.js'
      );
      defaultProject.targets.delete('e2e');
    }
  });
}

function updateTsConfig(options: Schema): Rule {
  return updateJsonInTree('tsconfig.base.json', (tsConfigJson) =>
    setUpCompilerOptions(tsConfigJson, options.npmScope, '')
  );
}

function updateTsConfigsJson(options: Schema) {
  return (host: Tree) => {
    const workspaceJson = readJsonInTree(host, 'angular.json');
    const app = workspaceJson.projects[options.name];
    const e2eProject = getE2eProject(workspaceJson);

    const offset = '../../';

    return chain([
      updateJsonInTree(app.architect.build.options.tsConfig, (json) => {
        json.extends = `${offset}tsconfig.base.json`;
        json.compilerOptions.outDir = `${offset}dist/out-tsc`;
        return json;
      }),

      app.architect.test
        ? updateJsonInTree(app.architect.test.options.tsConfig, (json) => {
            json.extends = `${offset}tsconfig.base.json`;
            json.compilerOptions.outDir = `${offset}dist/out-tsc`;
            return json;
          })
        : noop(),

      app.architect.server
        ? updateJsonInTree(app.architect.server.options.tsConfig, (json) => {
            json.compilerOptions.outDir = `${offset}dist/out-tsc`;
            return json;
          })
        : noop(),

      !!e2eProject
        ? updateJsonInTree(
            e2eProject.architect.lint.options.tsConfig,
            (json) => {
              json.extends = `${offsetFromRoot(
                e2eProject.root
              )}tsconfig.base.json`;
              json.compilerOptions = {
                ...json.compilerOptions,
                outDir: `${offsetFromRoot(e2eProject.root)}dist/out-tsc`,
              };
              return json;
            }
          )
        : noop(),
    ]);
  };
}

function updateTsLint() {
  return updateJsonInTree('tslint.json', (tslintJson) => {
    [
      'no-trailing-whitespace',
      'one-line',
      'quotemark',
      'typedef-whitespace',
      'whitespace',
    ].forEach((key) => {
      tslintJson[key] = undefined;
    });
    tslintJson.rulesDirectory = tslintJson.rulesDirectory || [];
    tslintJson.rulesDirectory.push('node_modules/@nrwl/workspace/src/tslint');
    tslintJson.rules['nx-enforce-module-boundaries'] = [
      true,
      {
        allow: [],
        depConstraints: [{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }],
      },
    ];
    return tslintJson;
  });
}

function updateProjectTsLint(options: Schema) {
  return (host: Tree) => {
    const workspaceJson = readJsonInTree(host, getWorkspacePath(host));
    const app = workspaceJson.projects[options.name];
    const offset = '../../';

    if (host.exists(`${app.root}/tslint.json`)) {
      return updateJsonInTree(`${app.root}/tslint.json`, (json) => {
        json.extends = `${offset}tslint.json`;
        return json;
      });
    }
    return host;
  };
}

function setUpCompilerOptions(
  tsconfig: any,
  npmScope: string,
  offset: string
): any {
  if (!tsconfig.compilerOptions.paths) {
    tsconfig.compilerOptions.paths = {};
  }
  tsconfig.compilerOptions.baseUrl = '.';
  tsconfig.compilerOptions.rootDir = '.';

  return tsconfig;
}

function moveOutOfSrc(
  tree: Tree,
  appName: string,
  filePath: string,
  context?: SchematicContext
) {
  const filename = !!filePath ? basename(filePath) : '';
  const from = filePath;
  const to = join(normalize('apps'), appName, filename);
  renameSyncInTree(tree, from, to, (err) => {
    if (!context) {
      return;
    } else if (!err) {
      context.logger.info(`Renamed ${from} -> ${to}`);
    } else {
      context.logger.warn(err);
    }
  });
}

function getE2eKey(workspaceJson: any) {
  return Object.keys(workspaceJson.projects).find((key) => {
    return !!workspaceJson.projects[key].architect.e2e;
  });
}

function getE2eProject(workspaceJson: any) {
  const key = getE2eKey(workspaceJson);
  if (key) {
    return workspaceJson.projects[key];
  } else {
    return null;
  }
}

function moveExistingFiles(options: Schema) {
  return (host: Tree, context: SchematicContext) => {
    const workspaceJson = readJsonInTree(host, getWorkspacePath(host));
    const app = workspaceJson.projects[options.name];
    const e2eApp = getE2eProject(workspaceJson);

    // No context is passed because it should not be required to have a browserslist
    moveOutOfSrc(host, options.name, 'browserslist');
    moveOutOfSrc(
      host,
      options.name,
      app.architect.build.options.tsConfig,
      context
    );

    if (app.architect.test) {
      moveOutOfSrc(
        host,
        options.name,
        app.architect.test.options.karmaConfig,
        context
      );
      moveOutOfSrc(
        host,
        options.name,
        app.architect.test.options.tsConfig,
        context
      );
    } else {
      // there could still be a karma.conf.js file in the root
      // so move to new location
      if (host.exists('karma.conf.js')) {
        context.logger.info(
          'No test configuration, but root Karma config file found'
        );

        moveOutOfSrc(host, options.name, 'karma.conf.js', context);
      }
    }

    if (app.architect.server) {
      moveOutOfSrc(
        host,
        options.name,
        app.architect.server.options.tsConfig,
        context
      );
    }
    const oldAppSourceRoot = app.sourceRoot;
    const newAppSourceRoot = join(
      normalize('apps'),
      options.name,
      app.sourceRoot
    );
    renameDirSyncInTree(host, oldAppSourceRoot, newAppSourceRoot, (err) => {
      if (!err) {
        context.logger.info(
          `Renamed ${oldAppSourceRoot} -> ${newAppSourceRoot}`
        );
      } else {
        context.logger.error(err);
        throw err;
      }
    });

    if (e2eApp) {
      const oldE2eRoot = 'e2e';
      const newE2eRoot = join(
        normalize('apps'),
        getE2eKey(workspaceJson) + '-e2e'
      );
      renameDirSyncInTree(host, oldE2eRoot, newE2eRoot, (err) => {
        if (!err) {
          context.logger.info(`Renamed ${oldE2eRoot} -> ${newE2eRoot}`);
        } else {
          context.logger.error(err);
          throw err;
        }
      });
    } else {
      context.logger.warn(
        'No e2e project was migrated because there was none declared in angular.json'
      );
    }

    return host;
  };
}

function createAdditionalFiles(options: Schema): Rule {
  return (host: Tree, _context: SchematicContext) => {
    const workspaceJson = readJsonInTree(host, 'angular.json');
    host.create(
      'nx.json',
      serializeJson({
        npmScope: options.npmScope,
        affected: {
          defaultBase: `${options.defaultBase}` || 'master',
        },
        implicitDependencies: {
          'angular.json': '*',
          'package.json': '*',
          'tsconfig.base.json': '*',
          'tslint.json': '*',
          'nx.json': '*',
        },
        projects: {
          [options.name]: {
            tags: [],
          },
          [getE2eKey(workspaceJson) + '-e2e']: {
            tags: [],
          },
        },
      })
    );
    host.create('libs/.gitkeep', '');

    host = updateJsonInTree(
      '.vscode/extensions.json',
      (json: { recommendations?: string[] }) => {
        json.recommendations = json.recommendations || [];
        [
          'nrwl.angular-console',
          'angular.ng-template',
          'ms-vscode.vscode-typescript-tslint-plugin',
          'esbenp.prettier-vscode',
        ].forEach((extension) => {
          if (!json.recommendations.includes(extension)) {
            json.recommendations.push(extension);
          }
        });

        return json;
      }
    )(host, _context) as Tree;

    // if the user does not already have a prettier configuration
    // of any kind, create one
    return from(resolveUserExistingPrettierConfig()).pipe(
      tap((existingPrettierConfig) => {
        if (!existingPrettierConfig) {
          host.create(
            '.prettierrc',
            serializeJson(DEFAULT_NRWL_PRETTIER_CONFIG)
          );
        }
      }),
      mapTo(host)
    );
  };
}

function checkCanConvertToWorkspace(options: Schema) {
  return (host: Tree, context: SchematicContext) => {
    try {
      if (!host.exists('package.json')) {
        throw new Error('Cannot find package.json');
      }

      if (!host.exists('angular.json')) {
        throw new Error('Cannot find angular.json');
      }

      // TODO: This restriction should be lited
      const workspaceJson = readJsonInTree(host, 'angular.json');
      if (Object.keys(workspaceJson.projects).length > 2) {
        throw new Error('Can only convert projects with one app');
      }
      const e2eKey = getE2eKey(workspaceJson);
      const e2eApp = getE2eProject(workspaceJson);
      if (
        e2eApp &&
        !host.exists(e2eApp.architect.e2e.options.protractorConfig)
      ) {
        context.logger.info(
          `Make sure the ${e2eKey}.architect.e2e.options.protractorConfig is valid or the ${e2eKey} project is removed from angular.json.`
        );
        throw new Error(
          `An e2e project was specified but ${e2eApp.architect.e2e.options.protractorConfig} could not be found.`
        );
      }

      return host;
    } catch (e) {
      context.logger.error(e.message);
      context.logger.error(
        'Your workspace could not be converted into an Nx Workspace because of the above error.'
      );
      throw e;
    }
  };
}

const createNxJson = (host: Tree) => {
  const json = JSON.parse(host.read('angular.json').toString());
  if (Object.keys(json.projects || {}).length !== 1) {
    throw new Error(
      `The schematic can only be used with Angular CLI workspaces with a single project.`
    );
  }
  const name = Object.keys(json.projects)[0];
  host.create(
    'nx.json',
    serializeJson({
      npmScope: name,
      implicitDependencies: {
        'angular.json': '*',
        'package.json': '*',
        'tsconfig.base.json': '*',
        'tslint.json': '*',
        'nx.json': '*',
      },
      projects: {
        [name]: {
          tags: [],
        },
      },
      tasksRunnerOptions: {
        default: {
          runner: '@nrwl/workspace/tasks-runners/default',
          options: {
            cacheableOperations: ['build', 'lint', 'test', 'e2e'],
          },
        },
      },
    })
  );
};

const decorateAngularClI = (host: Tree, context: SchematicContext) => {
  const decorateCli = readFileSync(
    pathJoin(__dirname as any, '..', 'utils', 'decorate-angular-cli.js__tmpl__')
  ).toString();
  host.create('decorate-angular-cli.js', decorateCli);
  updateJsonInTree('package.json', (json) => {
    if (
      json.scripts &&
      json.scripts.postinstall &&
      !json.scripts.postinstall.includes('decorate-angular-cli.js')
    ) {
      // if exists, add execution of this script
      json.scripts.postinstall += ' && node ./decorate-angular-cli.js';
    } else {
      if (!json.scripts) json.scripts = {};
      // if doesn't exist, set to execute this script
      json.scripts.postinstall = 'node ./decorate-angular-cli.js';
    }
    if (json.scripts.ng) {
      json.scripts.ng = 'nx';
    }
    return json;
  })(host, context);
};

const addFiles = (host: Tree, context: SchematicContext) => {
  const templateSource = apply(url('./files'), [
    filter(
      (path) =>
        !host.exists('/.prettierignore') || !(path === '/.prettierignore')
    ),
    template({
      tmpl: '',
    }),
  ]);
  return chain([mergeWith(templateSource)])(host, context);
};

export default function (schema: Schema): Rule {
  if (schema.preserveAngularCLILayout) {
    return chain([
      addDepsToPackageJson({}, { '@nrwl/workspace': nxVersion }),
      createNxJson,
      decorateAngularClI,
    ]);
  } else {
    const options = {
      ...schema,
      npmScope: toFileName(schema.npmScope || schema.name),
    };

    return chain([
      checkCanConvertToWorkspace(options),
      moveExistingFiles(options),
      addFiles,
      createAdditionalFiles(options),
      updatePackageJson(),
      updateAngularCLIJson(options),
      updateTsLint(),
      updateProjectTsLint(options),
      updateTsConfig(options),
      updateTsConfigsJson(options),
      decorateAngularClI,
      addInstallTask(options),
    ]);
  }
}
