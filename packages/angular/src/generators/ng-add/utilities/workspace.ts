import {
  generateFiles,
  joinPathFragments,
  NxJsonConfiguration,
  readJson,
  readWorkspaceConfiguration,
  Tree,
  updateJson,
  updateWorkspaceConfiguration,
  writeJson,
} from '@nrwl/devkit';
import { DEFAULT_NRWL_PRETTIER_CONFIG } from '@nrwl/workspace/src/generators/workspace/workspace';
import { deduceDefaultBase } from '@nrwl/workspace/src/utilities/default-base';
import { resolveUserExistingPrettierConfig } from '@nrwl/workspace/src/utilities/prettier';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
import { prettierVersion } from '@nrwl/workspace/src/utils/versions';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { angularDevkitVersion, nxVersion } from '../../../utils/versions';
import { GeneratorOptions } from '../schema';
import {
  getCypressConfigFile,
  getE2eKey,
  getE2eProject,
  isCypressE2eProject,
  isProtractorE2eProject,
} from './e2e-utils';
import { WorkspaceProjects } from './types';

// TODO: most of the validation here will be moved to the app migrator when
// support for multiple apps is added. This will only contain workspace-wide
// validation.
export function validateWorkspace(
  tree: Tree,
  projects: WorkspaceProjects
): void {
  try {
    if (!tree.exists('package.json')) {
      throw new Error('Cannot find package.json');
    }

    if (!tree.exists('angular.json')) {
      throw new Error('Cannot find angular.json');
    }

    const e2eKey = getE2eKey(projects);
    const e2eApp = getE2eProject(projects);

    if (!e2eApp) {
      return;
    }

    if (isProtractorE2eProject(e2eApp.config)) {
      if (tree.exists(e2eApp.config.targets.e2e.options.protractorConfig)) {
        return;
      }

      console.info(
        `Make sure the "${e2eKey}.architect.e2e.options.protractorConfig" is valid or the "${e2eKey}" project is removed from "angular.json".`
      );
      throw new Error(
        `An e2e project with Protractor was found but "${e2eApp.config.targets.e2e.options.protractorConfig}" could not be found.`
      );
    }

    if (isCypressE2eProject(e2eApp.config)) {
      const configFile = getCypressConfigFile(e2eApp.config);
      if (configFile && !tree.exists(configFile)) {
        throw new Error(
          `An e2e project with Cypress was found but "${configFile}" could not be found.`
        );
      }

      if (!tree.exists('cypress')) {
        throw new Error(
          `An e2e project with Cypress was found but the "cypress" directory could not be found.`
        );
      }

      return;
    }

    throw new Error(
      `An e2e project was found but it's using an unsupported executor "${e2eApp.config.targets.e2e.executor}".`
    );
  } catch (e) {
    console.error(e.message);
    console.error(
      'Your workspace could not be converted into an Nx Workspace because of the above error.'
    );
    throw e;
  }
}

export function createNxJson(
  tree: Tree,
  options: GeneratorOptions,
  setWorkspaceLayoutAsNewProjectRoot: boolean = false
): void {
  const { projects = {}, newProjectRoot = '' } = readJson(tree, 'angular.json');
  // TODO: temporarily leaving this here because it's the old behavior for a
  // minimal migration, will be removed in a later PR
  const hasLibraries = Object.keys(projects).find(
    (project) =>
      projects[project].projectType &&
      projects[project].projectType !== 'application'
  );
  if (Object.keys(projects).length !== 1 || hasLibraries) {
    throw new Error(
      `The schematic can only be used with Angular CLI workspaces with a single application.`
    );
  }

  writeJson<NxJsonConfiguration>(tree, 'nx.json', {
    npmScope: options.npmScope,
    affected: {
      defaultBase: options.defaultBase ?? deduceDefaultBase(),
    },
    implicitDependencies: {
      'package.json': {
        dependencies: '*',
        devDependencies: '*',
      },
      '.eslintrc.json': '*',
    },
    tasksRunnerOptions: {
      default: {
        runner: 'nx/tasks-runners/default',
        options: {
          cacheableOperations: ['build', 'lint', 'test', 'e2e'],
        },
      },
    },
    targetDependencies: {
      build: [
        {
          target: 'build',
          projects: 'dependencies',
        },
      ],
    },
    workspaceLayout: setWorkspaceLayoutAsNewProjectRoot
      ? { appsDir: newProjectRoot, libsDir: newProjectRoot }
      : undefined,
  });
}

export function decorateAngularCli(tree: Tree): void {
  const nrwlWorkspacePath = require.resolve('@nrwl/workspace/package.json');
  const decorateCli = readFileSync(
    join(
      dirname(nrwlWorkspacePath),
      'src/generators/utils/decorate-angular-cli.js__tmpl__'
    ),
    'utf-8'
  );
  tree.write('decorate-angular-cli.js', decorateCli);

  updateJson(tree, 'package.json', (json) => {
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
  });
}

export function updateWorkspaceConfigDefaults(tree: Tree): void {
  const workspaceConfig = readWorkspaceConfiguration(tree);
  delete (workspaceConfig as any).newProjectRoot;
  workspaceConfig.cli = workspaceConfig.cli ?? {};
  if (!workspaceConfig.cli.defaultCollection) {
    workspaceConfig.cli.defaultCollection = '@nrwl/angular';
  }
  updateWorkspaceConfiguration(tree, workspaceConfig);
}

export function updateRootTsConfig(tree: Tree): void {
  const tsconfig = readJson(tree, getRootTsConfigPathInTree(tree));
  tsconfig.compilerOptions.paths ??= {};
  tsconfig.compilerOptions.baseUrl = '.';
  tsconfig.compilerOptions.rootDir = '.';
  tsconfig.exclude = Array.from(
    new Set([...(tsconfig.exclude ?? []), 'node_modules', 'tmp'])
  );
  writeJson(tree, 'tsconfig.base.json', tsconfig);

  if (tree.exists('tsconfig.json')) {
    tree.delete('tsconfig.json');
  }
}

export function updatePackageJson(tree: Tree): void {
  updateJson(tree, 'package.json', (packageJson) => {
    packageJson.scripts = packageJson.scripts ?? {};
    Object.keys(packageJson.scripts).forEach((script) => {
      packageJson.scripts[script] = packageJson.scripts[script]
        .replace(/^ng /, 'nx ')
        .replace(/ ng /, ' nx ');
    });

    packageJson.devDependencies = packageJson.devDependencies ?? {};
    packageJson.dependencies = packageJson.dependencies ?? {};
    if (!packageJson.devDependencies['@angular/cli']) {
      packageJson.devDependencies['@angular/cli'] = angularDevkitVersion;
    }
    if (!packageJson.devDependencies['@nrwl/workspace']) {
      packageJson.devDependencies['@nrwl/workspace'] = nxVersion;
    }
    if (!packageJson.devDependencies['nx']) {
      packageJson.devDependencies['nx'] = nxVersion;
    }
    if (!packageJson.devDependencies['prettier']) {
      packageJson.devDependencies['prettier'] = prettierVersion;
    }

    return packageJson;
  });
}

export function updateTsLint(tree: Tree): void {
  if (!tree.exists(`tslint.json`)) {
    return;
  }

  updateJson(tree, 'tslint.json', (tslintJson) => {
    [
      'no-trailing-whitespace',
      'one-line',
      'quotemark',
      'typedef-whitespace',
      'whitespace',
    ].forEach((key) => {
      tslintJson[key] = undefined;
    });
    tslintJson.rulesDirectory = tslintJson.rulesDirectory ?? [];
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

export async function createWorkspaceFiles(tree: Tree): Promise<void> {
  updateVsCodeRecommendedExtensions(tree);
  await updatePrettierConfig(tree);

  generateFiles(tree, joinPathFragments(__dirname, '../files/root'), '.', {
    tmpl: '',
    dot: '.',
    rootTsConfigPath: getRootTsConfigPathInTree(tree),
  });
}

export function createRootKarmaConfig(tree: Tree): void {
  generateFiles(
    tree,
    joinPathFragments(__dirname, '../files/root-karma'),
    '.',
    {
      tmpl: '',
    }
  );
}

function updateVsCodeRecommendedExtensions(tree: Tree): void {
  const recommendations = [
    'nrwl.angular-console',
    'angular.ng-template',
    'dbaeumer.vscode-eslint',
    'esbenp.prettier-vscode',
  ];
  if (tree.exists('.vscode/extensions.json')) {
    updateJson(
      tree,
      '.vscode/extensions.json',
      (json: { recommendations?: string[] }) => {
        json.recommendations = json.recommendations || [];
        recommendations.forEach((extension) => {
          if (!json.recommendations.includes(extension)) {
            json.recommendations.push(extension);
          }
        });

        return json;
      }
    );
  } else {
    writeJson(tree, '.vscode/extensions.json', {
      recommendations,
    });
  }
}

async function updatePrettierConfig(tree: Tree): Promise<void> {
  const existingPrettierConfig = await resolveUserExistingPrettierConfig();
  if (!existingPrettierConfig) {
    writeJson(tree, '.prettierrc', DEFAULT_NRWL_PRETTIER_CONFIG);
  }

  if (!tree.exists('.prettierignore')) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/prettier'),
      '.',
      { tmpl: '', dot: '.' }
    );
  }
}
