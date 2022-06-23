#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { execSync } from 'child_process';
import * as enquirer from 'enquirer';
import * as yargsParser from 'yargs-parser';
import { output, readJsonFile, writeJsonFile } from '@nrwl/devkit';
import ignore from 'ignore';
import { directoryExists } from 'nx/src/utils/fileutils';

const parsedArgs = yargsParser(process.argv, {
  boolean: ['nxCloud'],
  configuration: {
    'strip-dashed': true,
    'strip-aliased': true,
  },
});

addNxToMonorepo().catch((e) => console.error(e));

export async function addNxToMonorepo() {
  const repoRoot = process.cwd();

  output.log({
    title: `🐳 Nx initialization`,
  });

  const useCloud = await askAboutNxCloud(parsedArgs);

  output.log({
    title: `🧑‍🔧 Analyzing the source code and creating configuration file`,
  });

  const packageJsonFiles = allProjectPackageJsonFiles(repoRoot);

  const pds = createProjectDesc(repoRoot, packageJsonFiles);

  if (pds.length === 0) {
    output.error({ title: `Cannot find any projects in this monorepo` });
    process.exit(1);
  }

  createNxJsonFile(repoRoot, pds);

  addDepsToPackageJson(repoRoot, useCloud);

  output.log({ title: `📦 Installing dependencies` });
  runInstall(repoRoot);

  if (useCloud) {
    initCloud(repoRoot);
  }

  printFinalMessage(repoRoot);
}

async function askAboutNxCloud(parsedArgs: any) {
  if (parsedArgs.nxCloud === undefined) {
    return enquirer
      .prompt([
        {
          name: 'NxCloud',
          message: `Set up distributed caching using Nx Cloud (It's free and doesn't require registration.)`,
          type: 'select',
          choices: [
            {
              name: 'Yes',
              hint: 'Faster builds, run details, GitHub integration. Learn more at https://nx.app',
            },

            {
              name: 'No',
            },
          ],
          initial: 'Yes' as any,
        },
      ])
      .then((a: { NxCloud: 'Yes' | 'No' }) => a.NxCloud === 'Yes');
  } else {
    return parsedArgs.nxCloud;
  }
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
        if (!s.isDirectory() && c == 'package.json') {
          res.push(path.relative(repoRoot, child));
        } else if (s.isDirectory()) {
          res = [...res, ...allPackageJsonFiles(repoRoot, child)];
        }
        // eslint-disable-next-line no-empty
      } catch (e) {}
    });
    // eslint-disable-next-line no-empty
  } catch (e) {}
  return res;
}

function getIgnoredGlobs(repoRoot: string) {
  const ig = ignore();
  try {
    ig.add(fs.readFileSync(`${repoRoot}/.gitignore`).toString());
    // eslint-disable-next-line no-empty
  } catch (e) {}
  return ig;
}

// creating project descs
interface ProjectDesc {
  name: string;
  dir: string;
  mainFilePath: string;
  scripts: string[];
}

function createProjectDesc(
  repoRoot: string,
  packageJsonFiles: string[]
): ProjectDesc[] {
  const res = [];
  packageJsonFiles.forEach((p) => {
    const dir = path.dirname(p);
    const packageJson = readJsonFile(path.join(repoRoot, p));
    if (!packageJson.name) return;

    const scripts = Object.keys(packageJson.scripts || {});
    if (packageJson.main) {
      res.push({
        name: packageJson.name,
        dir,
        mainFilePath: path.join(dir, packageJson.main),
        scripts,
      });
    } else if (packageJson.index) {
      res.push({
        name: packageJson.name,
        dir,
        mainFilePath: path.join(dir, packageJson.index),
        scripts,
      });
    } else {
      res.push({ name: packageJson.name, dir, mainFilePath: null, scripts });
    }
  });
  return res;
}

function createNxJsonFile(repoRoot: string, projects: ProjectDesc[]) {
  const allScripts = {};
  for (const p of projects) {
    for (const s of p.scripts) {
      allScripts[s] = true;
    }
  }

  const cacheableOperations = Object.keys(allScripts).filter(
    (s) => s.indexOf('serve') === -1 && s.indexOf('start') === -1
  );
  const targetDefaults = cacheableOperations
    .filter((c) => c === 'build' || c === 'prepare' || c === 'package')
    .reduce(
      (m, c) => ({
        ...m,
        [c]: { dependsOn: [`^${c}`] },
      }),
      {}
    );

  const res = {
    extends: 'nx/presets/npm.json',
    tasksRunnerOptions: {
      default: {
        runner: 'nx/tasks-runners/default',
        options: {
          cacheableOperations,
        },
      },
    },
    targetDefaults,
    affected: {
      defaultBase: deduceDefaultBase(),
    },
    workspaceLayout: deduceWorkspaceLayout(repoRoot),
  };

  writeJsonFile(`${repoRoot}/nx.json`, res);
}

function deduceWorkspaceLayout(repoRoot: string) {
  if (directoryExists(path.join(repoRoot, 'packages'))) {
    return undefined;
  } else if (directoryExists(path.join(repoRoot, 'projects'))) {
    return { libsDir: 'projects', appsDir: 'projects' };
  } else {
    return undefined;
  }
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
  const json = readJsonFile(path.join(repoRoot, `package.json`));
  if (!json.devDependencies) json.devDependencies = {};
  json.devDependencies['nx'] = require('../package.json').version;
  if (useCloud) {
    json.devDependencies['@nrwl/nx-cloud'] = 'latest';
  }
  writeJsonFile(`package.json`, json);
}

function runInstall(repoRoot: string) {
  cp.execSync(getPackageManagerCommand(repoRoot).install, { stdio: [0, 1, 2] });
}

function initCloud(repoRoot: string) {
  execSync(
    `${getPackageManagerCommand(repoRoot).exec} nx g @nrwl/nx-cloud:init`,
    {
      stdio: [0, 1, 2],
    }
  );
}

function getPackageManagerCommand(repoRoot: string): {
  install: string;
  exec: string;
} {
  const packageManager = fs.existsSync(path.join(repoRoot, 'yarn.lock'))
    ? 'yarn'
    : fs.existsSync(path.join(repoRoot, 'pnpm-lock.yaml'))
    ? 'pnpm'
    : 'npm';

  switch (packageManager) {
    case 'yarn':
      return {
        install: 'yarn',
        exec: 'yarn',
      };

    case 'pnpm':
      return {
        install: 'pnpm install --no-frozen-lockfile', // explicitly disable in case of CI
        exec: 'pnpx',
      };

    case 'npm':
      return {
        install: 'npm install --legacy-peer-deps',
        exec: 'npx',
      };
  }
}

function printFinalMessage(repoRoot) {
  output.success({
    title: `🎉 Done!`,
    bodyLines: [
      `- Enabled Computation caching!`,
      `- Run "${
        getPackageManagerCommand(repoRoot).exec
      } nx run-many --target=build --all" to run the build script for every project in the monorepo.`,
      `- Run it again to replay the cached computation.`,
      `- Run "${
        getPackageManagerCommand(repoRoot).exec
      } nx graph" to see the structure of the monorepo.`,
      `- Learn more at https://nx.dev/migration/adding-to-monorepo`,
    ],
  });
}
