import { prompt } from 'enquirer';
import { unlinkSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { toNewFormat } from '../../adapter/angular-json';
import { NxJsonConfiguration } from '../../config/nx-json';
import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../config/workspace-json-project-json';
import { fileExists, readJsonFile, writeJsonFile } from '../../utils/fileutils';
import { sortObjectByKeys } from '../../utils/object-sort';
import { output } from '../../utils/output';
import { PackageJson } from '../../utils/package-json';
import { normalizePath } from '../../utils/path';
import {
  addDepsToPackageJson,
  addVsCodeRecommendedExtensions,
  askAboutNxCloud,
  createNxJsonFile,
  initCloud,
  runInstall,
} from '../utils';
import { getLegacyMigrationFunctionIfApplicable } from './legacy-angular-versions';
import yargsParser = require('yargs-parser');

const defaultCacheableOperations: string[] = [
  'build',
  'server',
  'test',
  'lint',
];
const parsedArgs = yargsParser(process.argv, {
  boolean: ['yes'],
  string: ['cacheable'], // only used for testing
  alias: {
    yes: ['y'],
  },
});

let repoRoot: string;
let workspaceTargets: string[];

export async function addNxToAngularCliRepo() {
  repoRoot = process.cwd();

  output.log({ title: '🧐 Checking versions compatibility' });
  const legacyMigrationFn = await getLegacyMigrationFunctionIfApplicable(
    repoRoot,
    parsedArgs.yes !== true
  );
  if (legacyMigrationFn) {
    output.log({ title: '💽 Running migration for a legacy Angular version' });
    await legacyMigrationFn();
    process.exit(0);
  }

  output.success({
    title:
      '✅ The Angular version is compatible with the latest version of Nx!',
  });

  output.log({ title: '🐳 Nx initialization' });
  const cacheableOperations = await collectCacheableOperations();
  const useNxCloud = parsedArgs.yes !== true ? await askAboutNxCloud() : false;

  output.log({ title: '📦 Installing dependencies' });
  installDependencies(useNxCloud);

  output.log({ title: '📝 Setting up workspace' });
  await setupWorkspace(cacheableOperations);

  if (useNxCloud) {
    output.log({ title: '🛠️ Setting up Nx Cloud' });
    initCloud(repoRoot, 'nx-init-angular');
  }

  output.success({
    title: '🎉 Nx is now enabled in your workspace!',
    bodyLines: [
      `Execute 'npx nx build' twice to see the computation caching in action.`,
      'Learn more about the changes done to your workspace at https://nx.dev/recipes/adopting-nx/migration-angular.',
    ],
  });
}

async function collectCacheableOperations(): Promise<string[]> {
  let cacheableOperations: string[];

  workspaceTargets = getWorkspaceTargets();
  const defaultCacheableTargetsInWorkspace = defaultCacheableOperations.filter(
    (t) => workspaceTargets.includes(t)
  );

  if (parsedArgs.yes !== true) {
    output.log({
      title: `🧑‍🔧 Please answer the following questions about the targets found in your angular.json in order to generate task runner configuration`,
    });

    cacheableOperations = (
      (await prompt([
        {
          type: 'multiselect',
          name: 'cacheableOperations',
          initial: defaultCacheableTargetsInWorkspace as any,
          message:
            'Which of the following targets are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not)',
          // enquirer mutates the array below, create a new one to avoid it
          choices: [...workspaceTargets],
        },
      ])) as any
    ).cacheableOperations;
  } else {
    cacheableOperations = parsedArgs.cacheable
      ? parsedArgs.cacheable.split(',')
      : defaultCacheableTargetsInWorkspace;
  }

  return cacheableOperations;
}

function installDependencies(useNxCloud: boolean): void {
  addDepsToPackageJson(repoRoot, useNxCloud);
  addPluginDependencies();
  runInstall(repoRoot);
}

function addPluginDependencies(): void {
  const packageJsonPath = join(repoRoot, 'package.json');
  const packageJson = readJsonFile<PackageJson>(packageJsonPath);
  const nxVersion = require('../../../package.json').version;

  packageJson.devDependencies ??= {};
  packageJson.devDependencies['@nrwl/angular'] = nxVersion;
  packageJson.devDependencies['@nrwl/workspace'] = nxVersion;

  const peerDepsToInstall = [
    '@angular-devkit/core',
    '@angular-devkit/schematics',
    '@schematics/angular',
  ];
  const angularCliVersion =
    packageJson.devDependencies['@angular/cli'] ??
    packageJson.dependencies?.['@angular/cli'] ??
    packageJson.devDependencies['@angular-devkit/build-angular'] ??
    packageJson.dependencies?.['@angular-devkit/build-angular'];

  for (const dep of peerDepsToInstall) {
    if (!packageJson.devDependencies[dep] && !packageJson.dependencies?.[dep]) {
      packageJson.devDependencies[dep] = angularCliVersion;
    }
  }

  packageJson.devDependencies = sortObjectByKeys(packageJson.devDependencies);

  writeJsonFile(packageJsonPath, packageJson);
}

type AngularJsonConfigTargetConfiguration = Exclude<
  TargetConfiguration,
  'command' | 'executor' | 'outputs' | 'dependsOn' | 'inputs'
> & {
  builder: string;
};
type AngularJsonProjectConfiguration = {
  root: string;
  sourceRoot: string;
  architect?: Record<string, AngularJsonConfigTargetConfiguration>;
};
interface AngularJsonConfig {
  projects: Record<string, AngularJsonProjectConfiguration>;
  defaultProject?: string;
}

async function setupWorkspace(cacheableOperations: string[]): Promise<void> {
  const angularJsonPath = join(repoRoot, 'angular.json');
  const angularJson = readJsonFile<AngularJsonConfig>(angularJsonPath);
  const workspaceCapabilities = getWorkspaceCapabilities(angularJson.projects);
  createNxJson(angularJson, cacheableOperations, workspaceCapabilities);
  addVsCodeRecommendedExtensions(
    repoRoot,
    [
      'nrwl.angular-console',
      'angular.ng-template',
      workspaceCapabilities.eslintProjectConfigFile
        ? 'dbaeumer.vscode-eslint'
        : undefined,
    ].filter(Boolean)
  );
  replaceNgWithNxInPackageJsonScripts();

  // convert workspace config format to standalone project configs
  // update its targets outputs and delete angular.json
  const projects = toNewFormat(angularJson).projects;
  for (const [projectName, project] of Object.entries(projects)) {
    updateProjectOutputs(project);
    writeJsonFile(join(project.root, 'project.json'), {
      $schema: normalizePath(
        relative(
          join(repoRoot, project.root),
          join(repoRoot, 'node_modules/nx/schemas/project-schema.json')
        )
      ),
      name: projectName,
      ...project,
      root: undefined,
    });
  }
  unlinkSync(angularJsonPath);
}

type WorkspaceCapabilities = {
  eslintProjectConfigFile: boolean;
  test: boolean;
  karmaProjectConfigFile: boolean;
};

function createNxJson(
  angularJson: AngularJsonConfig,
  cacheableOperations: string[],
  {
    eslintProjectConfigFile,
    test,
    karmaProjectConfigFile,
  }: WorkspaceCapabilities
): void {
  createNxJsonFile(repoRoot, [], cacheableOperations, {});

  const nxJson = readJsonFile<NxJsonConfiguration>(join(repoRoot, 'nx.json'));
  nxJson.namedInputs = {
    sharedGlobals: [],
    default: ['{projectRoot}/**/*', 'sharedGlobals'],
    production: [
      'default',
      ...(test
        ? [
            '!{projectRoot}/tsconfig.spec.json',
            '!{projectRoot}/**/*.spec.[jt]s',
            karmaProjectConfigFile ? '!{projectRoot}/karma.conf.js' : undefined,
          ].filter(Boolean)
        : []),
      eslintProjectConfigFile ? '!{projectRoot}/.eslintrc.json' : undefined,
    ].filter(Boolean),
  };
  nxJson.targetDefaults = {};
  if (workspaceTargets.includes('build')) {
    nxJson.targetDefaults.build = {
      dependsOn: ['^build'],
      inputs: ['production', '^production'],
    };
  }
  if (workspaceTargets.includes('server')) {
    nxJson.targetDefaults.server = { inputs: ['production', '^production'] };
  }
  if (workspaceTargets.includes('test')) {
    const inputs = ['default', '^production'];
    if (fileExists(join(repoRoot, 'karma.conf.js'))) {
      inputs.push('{workspaceRoot}/karma.conf.js');
    }
    nxJson.targetDefaults.test = { inputs };
  }
  if (workspaceTargets.includes('lint')) {
    const inputs = ['default'];
    if (fileExists(join(repoRoot, '.eslintrc.json'))) {
      inputs.push('{workspaceRoot}/.eslintrc.json');
    }
    nxJson.targetDefaults.lint = { inputs };
  }
  if (workspaceTargets.includes('e2e')) {
    nxJson.targetDefaults.e2e = { inputs: ['default', '^production'] };
  }
  // Angular 14 workspaces support defaultProject, keep it until we drop support
  nxJson.defaultProject = angularJson.defaultProject;
  writeJsonFile(join(repoRoot, 'nx.json'), nxJson);
}

function updateProjectOutputs(project: ProjectConfiguration): void {
  Object.values(project.targets ?? {}).forEach((target) => {
    if (
      [
        '@angular-devkit/build-angular:browser',
        '@angular-builders/custom-webpack:browser',
        'ngx-build-plus:browser',
        '@angular-devkit/build-angular:server',
        '@angular-builders/custom-webpack:server',
        'ngx-build-plus:server',
      ].includes(target.executor)
    ) {
      target.outputs = ['{options.outputPath}'];
    } else if (target.executor === '@angular-eslint/builder:lint') {
      target.outputs = ['{options.outputFile}'];
    } else if (target.executor === '@angular-devkit/build-angular:ng-packagr') {
      try {
        const ngPackageJsonPath = join(repoRoot, target.options.project);
        const ngPackageJson = readJsonFile(ngPackageJsonPath);
        const outputPath = relative(
          repoRoot,
          resolve(dirname(ngPackageJsonPath), ngPackageJson.dest)
        );
        target.outputs = [`{workspaceRoot}/${normalizePath(outputPath)}`];
      } catch {}
    }
  });
}

function getWorkspaceTargets(): string[] {
  const { projects } = readJsonFile<AngularJsonConfig>(
    join(repoRoot, 'angular.json')
  );
  const targets = new Set<string>();
  for (const project of Object.values(projects ?? {})) {
    for (const target of Object.keys(project.architect ?? {})) {
      targets.add(target);
    }
  }

  return Array.from(targets);
}

function getWorkspaceCapabilities(
  projects: Record<string, AngularJsonProjectConfiguration>
): WorkspaceCapabilities {
  const capabilities = {
    eslintProjectConfigFile: false,
    test: false,
    karmaProjectConfigFile: false,
  };

  for (const project of Object.values(projects)) {
    if (
      !capabilities.eslintProjectConfigFile &&
      projectHasEslintConfig(project)
    ) {
      capabilities.eslintProjectConfigFile = true;
    }
    if (!capabilities.test && projectUsesKarmaBuilder(project)) {
      capabilities.test = true;
    }
    if (
      !capabilities.karmaProjectConfigFile &&
      projectHasKarmaConfig(project)
    ) {
      capabilities.karmaProjectConfigFile = true;
    }

    if (
      capabilities.eslintProjectConfigFile &&
      capabilities.test &&
      capabilities.karmaProjectConfigFile
    ) {
      return capabilities;
    }
  }

  return capabilities;
}

function projectUsesKarmaBuilder(
  project: AngularJsonProjectConfiguration
): boolean {
  return Object.values(project.architect ?? {}).some(
    (target) => target.builder === '@angular-devkit/build-angular:karma'
  );
}

function projectHasKarmaConfig(
  project: AngularJsonProjectConfiguration
): boolean {
  return fileExists(join(project.root, 'karma.conf.js'));
}

function projectHasEslintConfig(
  project: AngularJsonProjectConfiguration
): boolean {
  return fileExists(join(project.root, '.eslintrc.json'));
}

function replaceNgWithNxInPackageJsonScripts(): void {
  const packageJsonPath = join(repoRoot, 'package.json');
  const packageJson = readJsonFile<PackageJson>(packageJsonPath);
  packageJson.scripts ??= {};
  Object.keys(packageJson.scripts).forEach((script) => {
    packageJson.scripts[script] = packageJson.scripts[script]
      .replace(/^nx$/, 'nx')
      .replace(/^ng /, 'nx ')
      .replace(/ ng /g, ' nx ');
  });
  writeJsonFile(packageJsonPath, packageJson);
}
