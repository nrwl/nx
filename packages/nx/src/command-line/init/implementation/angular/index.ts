import { prompt } from 'enquirer';
import { join } from 'path';
import { readJsonFile, writeJsonFile } from '../../../../utils/fileutils';
import { nxVersion } from '../../../../utils/versions';
import { sortObjectByKeys } from '../../../../utils/object-sort';
import { output } from '../../../../utils/output';
import type { PackageJson } from '../../../../utils/package-json';
import {
  addDepsToPackageJson,
  initCloud,
  runInstall,
  updateGitIgnore,
} from '../utils';
import { setupIntegratedWorkspace } from './integrated-workspace';
import { getLegacyMigrationFunctionIfApplicable } from './legacy-angular-versions';
import { setupStandaloneWorkspace } from './standalone-workspace';
import type { AngularJsonConfig, Options } from './types';
import { connectExistingRepoToNxCloudPrompt } from '../../../connect/connect-to-nx-cloud';

const defaultCacheableOperations: string[] = [
  'build',
  'server',
  'test',
  'lint',
];

let repoRoot: string;
let workspaceTargets: string[];

export async function addNxToAngularCliRepo(options: Options) {
  repoRoot = process.cwd();

  output.log({ title: '🧐 Checking versions compatibility' });
  const legacyMigrationFn = await getLegacyMigrationFunctionIfApplicable(
    repoRoot,
    options
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
  const cacheableOperations = !options.integrated
    ? await collectCacheableOperations(options)
    : [];
  const useNxCloud =
    options.nxCloud ??
    (options.interactive ? await connectExistingRepoToNxCloudPrompt() : false);

  output.log({ title: '📦 Installing dependencies' });
  installDependencies();

  output.log({ title: '📝 Setting up workspace' });
  await setupWorkspace(cacheableOperations, options.integrated);

  if (useNxCloud) {
    output.log({ title: '🛠️ Setting up Nx Cloud' });
    initCloud(repoRoot, 'nx-init-angular');
  }
}

async function collectCacheableOperations(options: Options): Promise<string[]> {
  let cacheableOperations: string[];

  workspaceTargets = getWorkspaceTargets();
  const defaultCacheableTargetsInWorkspace = defaultCacheableOperations.filter(
    (t) => workspaceTargets.includes(t)
  );

  if (options.interactive && workspaceTargets.length > 0) {
    output.log({
      title:
        '🧑‍🔧 Please answer the following questions about the targets found in your angular.json in order to generate task runner configuration',
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
          /**
           * limit is missing from the interface but it limits the amount of options shown
           */
          limit: process.stdout.rows - 4, // 4 leaves room for the header above, the prompt and some whitespace
        } as any,
      ])) as any
    ).cacheableOperations;
  } else {
    cacheableOperations =
      options.cacheable ?? defaultCacheableTargetsInWorkspace;
  }

  return cacheableOperations;
}

function installDependencies(): void {
  addDepsToPackageJson(repoRoot);
  addPluginDependencies();
  runInstall(repoRoot);
}

function addPluginDependencies(): void {
  const packageJsonPath = join(repoRoot, 'package.json');
  const packageJson = readJsonFile<PackageJson>(packageJsonPath);

  packageJson.devDependencies ??= {};
  packageJson.devDependencies['@nx/angular'] = nxVersion;
  packageJson.devDependencies['@nx/workspace'] = nxVersion;

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

async function setupWorkspace(
  cacheableOperations: string[],
  isIntegratedMigration: boolean
): Promise<void> {
  updateGitIgnore(repoRoot);

  if (isIntegratedMigration) {
    setupIntegratedWorkspace();
  } else {
    await setupStandaloneWorkspace(
      repoRoot,
      cacheableOperations,
      workspaceTargets
    );
  }
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
