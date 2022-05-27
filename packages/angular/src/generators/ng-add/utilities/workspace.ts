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
import { Linter, lintInitGenerator } from '@nrwl/linter';
import { DEFAULT_NRWL_PRETTIER_CONFIG } from '@nrwl/workspace/src/generators/workspace/workspace';
import { deduceDefaultBase } from '@nrwl/workspace/src/utilities/default-base';
import { resolveUserExistingPrettierConfig } from '@nrwl/workspace/src/utilities/prettier';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
import { prettierVersion } from '@nrwl/workspace/src/utils/versions';
import { readFileSync } from 'fs';
import { readModulePackageJson } from 'nx/src/utils/package-json';
import { dirname, join } from 'path';
import { angularDevkitVersion, nxVersion } from '../../../utils/versions';
import { GeneratorOptions } from '../schema';
import { WorkspaceCapabilities, WorkspaceProjects } from './types';
import { workspaceMigrationErrorHeading } from './validation-logging';

export function validateWorkspace(tree: Tree): void {
  const errors: string[] = [];
  if (!tree.exists('package.json')) {
    errors.push('The "package.json" file could not be found.');
  }
  if (!tree.exists('angular.json')) {
    errors.push('The "angular.json" file could not be found.');
  }

  if (!errors.length) {
    return;
  }

  throw new Error(`${workspaceMigrationErrorHeading}

  - ${errors.join('\n  ')}`);
}

export function createNxJson(
  tree: Tree,
  options: GeneratorOptions,
  setWorkspaceLayoutAsNewProjectRoot: boolean = false
): void {
  const { newProjectRoot = '' } = readJson(tree, 'angular.json');

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
  const nrwlWorkspacePath = readModulePackageJson('@nrwl/workspace').path;
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

export function updateRootEsLintConfig(
  tree: Tree,
  existingEsLintConfig: any | undefined
): void {
  if (tree.exists('.eslintrc.json')) {
    /**
     * If it still exists it means that there was no project at the root of the
     * workspace, so it was not moved. In that case, we remove the file so the
     * init generator do its work. We still receive the content of the file,
     * so we update it after the init generator has run.
     */
    tree.delete('.eslintrc.json');
  }

  lintInitGenerator(tree, { linter: Linter.EsLint });

  if (!existingEsLintConfig) {
    // There was no eslint config in the root, so we keep the generated one as-is.
    return;
  }

  existingEsLintConfig.ignorePatterns = ['**/*'];
  existingEsLintConfig.plugins = Array.from(
    new Set([...(existingEsLintConfig.plugins ?? []), '@nrwl/nx'])
  );
  existingEsLintConfig.overrides?.forEach((override) => {
    if (!override.parserOptions?.project) {
      return;
    }

    delete override.parserOptions.project;
  });
  // add the @nrwl/nx/enforce-module-boundaries rule
  existingEsLintConfig.overrides = [
    ...(existingEsLintConfig.overrides ?? []),
    {
      files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
      rules: {
        '@nrwl/nx/enforce-module-boundaries': [
          'error',
          {
            enforceBuildableLibDependency: true,
            allow: [],
            depConstraints: [
              { sourceTag: '*', onlyDependOnLibsWithTags: ['*'] },
            ],
          },
        ],
      },
    },
  ];

  writeJson(tree, '.eslintrc.json', existingEsLintConfig);
}

export function cleanupEsLintPackages(tree: Tree): void {
  updateJson(tree, 'package.json', (json) => {
    if (json.devDependencies?.['@angular-eslint/builder']) {
      delete json.devDependencies['@angular-eslint/builder'];
    }
    if (json.dependencies?.['@angular-eslint/builder']) {
      delete json.dependencies['@angular-eslint/builder'];
    }
    if (json.devDependencies?.['@angular-eslint/schematics']) {
      delete json.devDependencies['@angular-eslint/schematics'];
    }
    if (json.dependencies?.['@angular-eslint/schematics']) {
      delete json.dependencies['@angular-eslint/schematics'];
    }

    return json;
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

export function getWorkspaceCapabilities(
  tree: Tree,
  projects: WorkspaceProjects
): WorkspaceCapabilities {
  const capabilities: WorkspaceCapabilities = { eslint: false, karma: false };

  if (tree.exists('.eslintrc.json')) {
    capabilities.eslint = true;
  }
  if (tree.exists('karma.conf.js')) {
    capabilities.karma = true;
  }

  if (capabilities.eslint && capabilities.karma) {
    return capabilities;
  }

  for (const project of [...projects.apps, ...projects.libs]) {
    if (
      !capabilities.eslint &&
      (project.config.targets?.lint ||
        tree.exists(`${project.config.root}/.eslintrc.json`))
    ) {
      capabilities.eslint = true;
    }
    if (
      !capabilities.karma &&
      (project.config.targets?.test ||
        tree.exists(`${project.config.root}/karma.conf.js`))
    ) {
      capabilities.karma = true;
    }

    if (capabilities.eslint && capabilities.karma) {
      return capabilities;
    }
  }

  return capabilities;
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
