#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import * as enquirer from 'enquirer';
import { joinPathFragments } from 'nx/src/utils/path';
import { getPackageManagerCommand } from 'nx/src/utils/package-manager';
import { output } from 'nx/src/utils/output';
import { readJsonFile } from 'nx/src/utils/fileutils';
import ignore from 'ignore';
import * as yargsParser from 'yargs-parser';
import {
  askAboutNxCloud,
  createNxJsonFile,
  initCloud,
  runInstall,
  addDepsToPackageJson,
} from 'nx/src/nx-init/utils';

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

  const packageJsonFiles = allProjectPackageJsonFiles(repoRoot);
  const scripts = combineAllScriptNames(repoRoot, packageJsonFiles);

  let targetDefaults: string[];
  let cacheableOperations: string[];
  let scriptOutputs = {} as { [script: string]: string };
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
          message: `Which scripts need to be run in order?  (e.g. before building a project, dependent projects must be built.)`,
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
            'Which scripts are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not)',
          choices: scripts,
        },
      ])) as any
    ).cacheableOperations;

    for (const scriptName of cacheableOperations) {
      // eslint-disable-next-line no-await-in-loop
      scriptOutputs[scriptName] = (
        await enquirer.prompt([
          {
            type: 'input',
            name: scriptName,
            message: `Does the "${scriptName}" script create any outputs? If not, leave blank, otherwise provide a path relative to a project root (e.g. dist, lib, build, coverage)`,
          },
        ])
      )[scriptName];
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
    scriptOutputs,
    undefined
  );

  addDepsToPackageJson(repoRoot, useCloud);

  output.log({ title: `📦 Installing dependencies` });
  runInstall(repoRoot);

  if (useCloud) {
    initCloud(repoRoot);
  }

  printFinalMessage();
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

function printFinalMessage() {
  const pmc = getPackageManagerCommand();
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
