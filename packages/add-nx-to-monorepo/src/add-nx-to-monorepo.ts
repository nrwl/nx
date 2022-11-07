#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import * as enquirer from 'enquirer';
import { joinPathFragments } from 'nx/src/utils/path';
import {
  getPackageManagerCommand,
  PackageManagerCommands,
} from 'nx/src/utils/package-manager';
import { output } from 'nx/src/utils/output';
import { readJsonFile, writeJsonFile } from 'nx/src/utils/fileutils';
import ignore from 'ignore';
import * as yargsParser from 'yargs-parser';

const parsedArgs = yargsParser(process.argv, {
  boolean: ['yes'],
  alias: {
    yes: ['y'],
  },
});

addNxToMonorepo().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function addNxToMonorepo() {
  const repoRoot = process.cwd();

  if (!fs.existsSync(joinPathFragments(repoRoot, 'package.json'))) {
    output.error({
      title: `Run the command in the folder with a package.json file.`,
    });
    process.exit(1);
  }

  output.log({ title: `🐳 Nx initialization` });

  const pmc = getPackageManagerCommand();
  const packageJsonFiles = allProjectPackageJsonFiles(repoRoot);
  const scripts = combineAllScriptNames(repoRoot, packageJsonFiles);

  let targetDefaults: string[];
  let cacheableOperations: string[];
  let scriptOutputs = {};
  let useCloud: boolean;

  if (parsedArgs.yes !== true) {
    output.log({
      title: `🧑‍🔧 Please answer the following questions about the scripts found in your workspace in order to generate task runner configuration`,
    });

    targetDefaults = (
      (await enquirer.prompt([
        {
          type: 'multiselect',
          name: 'targetDefaults',
          message:
            'Which of the following scripts need to be run in deterministic/topological order?',
          choices: scripts,
        },
      ])) as any
    ).targetDefaults;

    cacheableOperations = (
      (await enquirer.prompt([
        {
          type: 'multiselect',
          name: 'cacheableOperations',
          message:
            'Which of the following scripts are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not)',
          choices: scripts,
        },
      ])) as any
    ).cacheableOperations;

    for (const scriptName of cacheableOperations) {
      // eslint-disable-next-line no-await-in-loop
      scriptOutputs[scriptName] = await enquirer.prompt([
        {
          type: 'input',
          name: scriptName,
          message: `Does the "${scriptName}" script create any outputs? If not, leave blank, otherwise provide a path relative to a project root (e.g. dist, lib, build, coverage)`,
        },
      ]);
    }

    useCloud = await askAboutNxCloud();
  } else {
    targetDefaults = [];
    cacheableOperations = [];
    useCloud = false;
  }

  createNxJsonFile(
    repoRoot,
    targetDefaults,
    cacheableOperations,
    scriptOutputs
  );

  addDepsToPackageJson(repoRoot, useCloud);

  output.log({ title: `📦 Installing dependencies` });
  runInstall(repoRoot, pmc);

  if (useCloud) {
    initCloud(repoRoot, pmc);
  }

  printFinalMessage(pmc);
}

function askAboutNxCloud() {
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

// scanning package.json files
function allProjectPackageJsonFiles(repoRoot: string) {
  const packageJsonFiles = allPackageJsonFiles(repoRoot, repoRoot);
  return packageJsonFiles.filter((c) => c != 'package.json');
}

function allPackageJsonFiles(repoRoot: string, dirName: string) {
  const ignoredGlobs = getIgnoredGlobs(repoRoot);
  const relDirName = path.relative(repoRoot, dirName);
  if (
    relDirName &&
    (ignoredGlobs.ignores(relDirName) ||
      relDirName.indexOf(`node_modules`) > -1)
  ) {
    return [];
  }

  let res = [];
  try {
    fs.readdirSync(dirName).forEach((c) => {
      const child = path.join(dirName, c);
      if (ignoredGlobs.ignores(path.relative(repoRoot, child))) {
        return;
      }
      try {
        const s = fs.statSync(child);
        if (s.isFile() && c == 'package.json') {
          res.push(path.relative(repoRoot, child));
        } else if (s.isDirectory()) {
          res = [...res, ...allPackageJsonFiles(repoRoot, child)];
        }
        // eslint-disable-next-line no-empty
      } catch {}
    });
    // eslint-disable-next-line no-empty
  } catch {}
  return res;
}

function getIgnoredGlobs(repoRoot: string) {
  const ig = ignore();
  try {
    ig.add(fs.readFileSync(`${repoRoot}/.gitignore`).toString());
    // eslint-disable-next-line no-empty
  } catch {}
  return ig;
}

function combineAllScriptNames(
  repoRoot: string,
  packageJsonFiles: string[]
): string[] {
  const res = new Set<string>();
  packageJsonFiles.forEach((p) => {
    const packageJson = readJsonFile(path.join(repoRoot, p));
    Object.keys(packageJson.scripts || {}).forEach((scriptName) =>
      res.add(scriptName)
    );
  });
  return [...res];
}

function createNxJsonFile(
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
  nxJson.targetDefaults ||= {};
  for (const scriptName of targetDefaults) {
    nxJson.targetDefaults[scriptName] ||= {};
    nxJson.targetDefaults[scriptName] = { dependsOn: [`^${scriptName}`] };
  }
  for (const [scriptName, scriptAnswerData] of Object.entries(scriptOutputs)) {
    if (!scriptAnswerData[scriptName]) {
      // eslint-disable-next-line no-continue
      continue;
    }
    nxJson.targetDefaults[scriptName] ||= {};
    nxJson.targetDefaults[scriptName].outputs = [
      `{projectRoot}/${scriptAnswerData[scriptName]}`,
    ];
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

// add dependencies
function addDepsToPackageJson(repoRoot: string, useCloud: boolean) {
  const json = readJsonFile(joinPathFragments(repoRoot, `package.json`));
  if (!json.devDependencies) json.devDependencies = {};
  json.devDependencies['nx'] = require('../package.json').version;
  if (useCloud) {
    json.devDependencies['@nrwl/nx-cloud'] = 'latest';
  }
  writeJsonFile(`package.json`, json);
}

function runInstall(repoRoot: string, pmc: PackageManagerCommands) {
  execSync(pmc.install, { stdio: [0, 1, 2], cwd: repoRoot });
}

function initCloud(repoRoot: string, pmc: PackageManagerCommands) {
  execSync(
    `${pmc.exec} nx g @nrwl/nx-cloud:init --installationSource=add-nx-to-monorepo`,
    {
      stdio: [0, 1, 2],
      cwd: repoRoot,
    }
  );
}

function printFinalMessage(pmc: PackageManagerCommands) {
  output.success({
    title: `🎉 Done!`,
    bodyLines: [
      `- Enabled computation caching!`,
      `- Run "${pmc.exec} nx run-many --target=build" to run the build script for every project in the monorepo.`,
      `- Run it again to replay the cached computation.`,
      `- Run "${pmc.exec} nx graph" to see the structure of the monorepo.`,
      `- Learn more at https://nx.dev/recipes/adopting-nx/adding-to-monorepo`,
    ],
  });
}
