import { execSync } from 'child_process';
import * as enquirer from 'enquirer';
import { join } from 'path';
import { fileExists, readJsonFile, writeJsonFile } from '../utils/fileutils';
import {
  getPackageManagerCommand,
  PackageManagerCommands,
} from '../utils/package-manager';
import { runNxSync } from '../utils/child-process';
import { joinPathFragments } from '../utils/path';

export function askAboutNxCloud() {
  return enquirer
    .prompt([
      {
        name: 'NxCloud',
        message: `Enable distributed caching to make your CI faster`,
        type: 'autocomplete',
        choices: [
          {
            name: 'Yes',
            hint: 'I want faster builds',
          },

          {
            name: 'No',
          },
        ],
        initial: 'Yes' as any,
      },
    ])
    .then((a: { NxCloud: 'Yes' | 'No' }) => a.NxCloud === 'Yes');
}

export function createNxJsonFile(
  repoRoot: string,
  targetDefaults: string[],
  cacheableOperations: string[],
  scriptOutputs: { [name: string]: string }
) {
  const nxJsonPath = joinPathFragments(repoRoot, 'nx.json');
  let nxJson = {} as any;
  try {
    nxJson = readJsonFile(nxJsonPath);
    // eslint-disable-next-line no-empty
  } catch {}

  nxJson.tasksRunnerOptions ||= {};
  nxJson.tasksRunnerOptions.default ||= {};
  nxJson.tasksRunnerOptions.default.runner ||= 'nx/tasks-runners/default';
  nxJson.tasksRunnerOptions.default.options ||= {};
  nxJson.tasksRunnerOptions.default.options.cacheableOperations =
    cacheableOperations;

  if (targetDefaults.length > 0) {
    nxJson.targetDefaults ||= {};
    for (const scriptName of targetDefaults) {
      nxJson.targetDefaults[scriptName] ||= {};
      nxJson.targetDefaults[scriptName] = { dependsOn: [`^${scriptName}`] };
    }
    for (const [scriptName, output] of Object.entries(scriptOutputs)) {
      if (!output) {
        // eslint-disable-next-line no-continue
        continue;
      }
      nxJson.targetDefaults[scriptName] ||= {};
      nxJson.targetDefaults[scriptName].outputs = [`{projectRoot}/${output}`];
    }
  }
  nxJson.defaultBase = deduceDefaultBase();
  writeJsonFile(nxJsonPath, nxJson);
}

function deduceDefaultBase() {
  try {
    execSync(`git rev-parse --verify main`, {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return 'main';
  } catch {
    try {
      execSync(`git rev-parse --verify dev`, {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      return 'dev';
    } catch {
      try {
        execSync(`git rev-parse --verify develop`, {
          stdio: ['ignore', 'ignore', 'ignore'],
        });
        return 'develop';
      } catch {
        try {
          execSync(`git rev-parse --verify next`, {
            stdio: ['ignore', 'ignore', 'ignore'],
          });
          return 'next';
        } catch {
          return 'master';
        }
      }
    }
  }
}

export function addDepsToPackageJson(repoRoot: string, useCloud: boolean) {
  const path = joinPathFragments(repoRoot, `package.json`);
  const json = readJsonFile(path);
  if (!json.devDependencies) json.devDependencies = {};
  json.devDependencies['nx'] = require('../../package.json').version;
  if (useCloud) {
    json.devDependencies['@nrwl/nx-cloud'] = 'latest';
  }
  writeJsonFile(path, json);
}

export function runInstall(
  repoRoot: string,
  pmc: PackageManagerCommands = getPackageManagerCommand()
) {
  execSync(pmc.install, { stdio: [0, 1, 2], cwd: repoRoot });
}

export function initCloud(
  repoRoot: string,
  installationSource:
    | 'nx-init-angular'
    | 'nx-init-cra'
    | 'nx-init-monorepo'
    | 'nx-init-nest'
    | 'nx-init-npm-repo'
) {
  runNxSync(
    `g @nrwl/nx-cloud:init --installationSource=${installationSource}`,
    {
      stdio: [0, 1, 2],
      cwd: repoRoot,
    }
  );
}

export function addVsCodeRecommendedExtensions(
  repoRoot: string,
  extensions: string[]
): void {
  const vsCodeExtensionsPath = join(repoRoot, '.vscode/extensions.json');

  if (fileExists(vsCodeExtensionsPath)) {
    const vsCodeExtensionsJson = readJsonFile(vsCodeExtensionsPath);

    vsCodeExtensionsJson.recommendations ??= [];
    extensions.forEach((extension) => {
      if (!vsCodeExtensionsJson.recommendations.includes(extension)) {
        vsCodeExtensionsJson.recommendations.push(extension);
      }
    });

    writeJsonFile(vsCodeExtensionsPath, vsCodeExtensionsJson);
  } else {
    writeJsonFile(vsCodeExtensionsPath, { recommendations: extensions });
  }
}
