import { joinPathFragments } from '../utils/path';
import { readJsonFile, writeJsonFile } from '../utils/fileutils';
import * as enquirer from 'enquirer';
import { execSync } from 'child_process';
import { getPackageManagerCommand } from '../utils/package-manager';

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
  scriptOutputs: { [name: string]: string },
  defaultProject: string | undefined
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
  if (defaultProject) {
    nxJson.defaultProject = defaultProject;
  }
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

export function runInstall(repoRoot: string) {
  const pmc = getPackageManagerCommand();
  execSync(pmc.install, { stdio: [0, 1, 2], cwd: repoRoot });
}

export function initCloud(repoRoot: string) {
  const pmc = getPackageManagerCommand();
  execSync(
    `${pmc.exec} nx g @nrwl/nx-cloud:init --installationSource=add-nx-to-monorepo`,
    {
      stdio: [0, 1, 2],
      cwd: repoRoot,
    }
  );
}
