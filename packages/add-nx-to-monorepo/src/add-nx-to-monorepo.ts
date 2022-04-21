#!/usr/bin/env node

import * as stripJsonComments from 'strip-json-comments';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import * as enquirer from 'enquirer';
import * as yargsParser from 'yargs-parser';

import { execSync } from 'child_process';
import { output } from '@nrwl/devkit';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ignore = require('ignore');
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

  createNxJsonFile(repoRoot);

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
          message: `Use Nx Cloud? (It's free and doesn't require registration.)`,
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
}

function createProjectDesc(
  repoRoot: string,
  packageJsonFiles: string[]
): ProjectDesc[] {
  const res = [];
  packageJsonFiles.forEach((p) => {
    const dir = path.dirname(p);
    const packageJson = readJsonFile(repoRoot, p);
    if (!packageJson.name) return;

    if (packageJson.main) {
      res.push({
        name: packageJson.name,
        dir,
        mainFilePath: path.join(dir, packageJson.main),
      });
    } else if (packageJson.index) {
      res.push({
        name: packageJson.name,
        dir,
        mainFilePath: path.join(dir, packageJson.index),
      });
    } else {
      res.push({ name: packageJson.name, dir, mainFilePath: null });
    }
  });
  return res;
}

function readJsonFile(repoRoot: string, file: string) {
  return JSON.parse(
    stripJsonComments(fs.readFileSync(path.join(repoRoot, file)).toString())
  );
}

function detectWorkspaceScope(repoRoot: string) {
  let scope = readJsonFile(repoRoot, `package.json`).name;
  if (!scope) return 'undetermined';

  if (scope.startsWith('@')) {
    scope = scope.substring(1);
  }

  return scope.split('/')[0];
}

function createNxJsonFile(repoRoot: string) {
  const scope = detectWorkspaceScope(repoRoot);
  const res = {
    extends: 'nx/presets/npm.json',
    npmScope: scope,
    tasksRunnerOptions: {
      default: {
        runner: 'nx/tasks-runners/default',
        options: {
          cacheableOperations: ['build', 'test', 'lint', 'package', 'prepare'],
        },
      },
    },
    targetDependencies: {
      build: [{ target: 'build', projects: 'dependencies' }],
      prepare: [{ target: 'prepare', projects: 'dependencies' }],
      package: [{ target: 'package', projects: 'dependencies' }],
    },
    affected: {
      defaultBase: deduceDefaultBase(),
    },
    workspaceLayout: deduceWorkspaceLayout(repoRoot),
    pluginsConfig: {
      '@nrwl/js': {
        analyzeSourceFiles: false,
      },
    },
  };

  fs.writeFileSync(`${repoRoot}/nx.json`, JSON.stringify(res, null, 2));
}

function deduceWorkspaceLayout(repoRoot: string) {
  if (exists(path.join(repoRoot, 'packages'))) {
    return undefined;
  } else if (exists(path.join(repoRoot, 'projects'))) {
    return { libsDir: 'projects', appsDir: 'projects' };
  } else {
    return undefined;
  }
}

function exists(folder: string) {
  try {
    const s = fs.statSync(folder);
    return s.isDirectory();
    // eslint-disable-next-line no-empty
  } catch (e) {
    return false;
  }
}

function deduceDefaultBase() {
  try {
    execSync(`git rev-parse --verify main`, {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return 'main';
  } catch (e) {
    try {
      execSync(`git rev-parse --verify dev`, {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      return 'dev';
    } catch (e) {
      try {
        execSync(`git rev-parse --verify next`, {
          stdio: ['ignore', 'ignore', 'ignore'],
        });
        return 'next';
      } catch (e) {
        return 'master';
      }
    }
  }
}

// add dependencies
function addDepsToPackageJson(repoRoot: string, useCloud: boolean) {
  const json = readJsonFile(repoRoot, `package.json`);
  if (!json.devDependencies) json.devDependencies = {};
  json.devDependencies['nx'] = 'NX_VERSION';
  if (useCloud) {
    json.devDependencies['@nrwl/nx-cloud'] = 'latest';
  }
  fs.writeFileSync(`package.json`, JSON.stringify(json, null, 2));
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
