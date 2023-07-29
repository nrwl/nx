import { unlinkSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { toNewFormat } from '../../../../adapter/angular-json';
import type { NxJsonConfiguration } from '../../../../config/nx-json';
import type { ProjectConfiguration } from '../../../../config/workspace-json-project-json';
import {
  fileExists,
  readJsonFile,
  writeJsonFile,
} from '../../../../utils/fileutils';
import type { PackageJson } from '../../../../utils/package-json';
import { normalizePath } from '../../../../utils/path';
import { addVsCodeRecommendedExtensions, createNxJsonFile } from '../utils';
import type {
  AngularJsonConfig,
  AngularJsonProjectConfiguration,
  WorkspaceCapabilities,
} from './types';

export async function setupStandaloneWorkspace(
  repoRoot: string,
  cacheableOperations: string[],
  workspaceTargets: string[]
): Promise<void> {
  const angularJsonPath = join(repoRoot, 'angular.json');
  const angularJson = readJsonFile<AngularJsonConfig>(angularJsonPath);
  const workspaceCapabilities = getWorkspaceCapabilities(angularJson.projects);
  createNxJson(
    repoRoot,
    angularJson,
    cacheableOperations,
    workspaceCapabilities,
    workspaceTargets
  );
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
  replaceNgWithNxInPackageJsonScripts(repoRoot);

  // convert workspace config format to standalone project configs
  // update its targets outputs and delete angular.json
  const projects = toNewFormat(angularJson).projects;
  for (const [projectName, project] of Object.entries(projects ?? {})) {
    updateProjectOutputs(repoRoot, project);
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

function createNxJson(
  repoRoot: string,
  angularJson: AngularJsonConfig,
  cacheableOperations: string[],
  {
    eslintProjectConfigFile,
    test,
    karmaProjectConfigFile,
  }: WorkspaceCapabilities,
  workspaceTargets: string[]
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

function updateProjectOutputs(
  repoRoot: string,
  project: ProjectConfiguration
): void {
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

function getWorkspaceCapabilities(
  projects: Record<string, AngularJsonProjectConfiguration>
): WorkspaceCapabilities {
  const capabilities = {
    eslintProjectConfigFile: false,
    test: false,
    karmaProjectConfigFile: false,
  };

  for (const project of Object.values(projects ?? {})) {
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

function replaceNgWithNxInPackageJsonScripts(repoRoot: string): void {
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
