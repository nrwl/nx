import { prompt } from 'enquirer';
import { readdirSync, readFileSync, statSync } from 'fs';
import ignore from 'ignore';
import { join, relative } from 'path';
import { InitArgs } from '../init-v1';
import { readJsonFile } from '../../../utils/fileutils';
import { output } from '../../../utils/output';
import {
  addDepsToPackageJson,
  createNxJsonFile,
  initCloud,
  runInstall,
  updateGitIgnore,
} from './utils';
import { connectExistingRepoToNxCloudPrompt } from '../../connect/connect-to-nx-cloud';

type Options = Pick<InitArgs, 'nxCloud' | 'interactive' | 'cacheable'> & {
  legacy?: boolean;
};

export async function addNxToMonorepo(options: Options) {
  const repoRoot = process.cwd();

  output.log({ title: '🐳 Nx initialization' });

  const packageJsonFiles = allProjectPackageJsonFiles(repoRoot);
  const scripts = combineAllScriptNames(repoRoot, packageJsonFiles);

  let targetDefaults: string[];
  let cacheableOperations: string[];
  let scriptOutputs = {} as { [script: string]: string };
  let useNxCloud: boolean;

  if (options.interactive && scripts.length > 0) {
    output.log({
      title:
        '🧑‍🔧 Please answer the following questions about the scripts found in your workspace in order to generate task runner configuration',
    });

    targetDefaults = (
      await prompt<{ targetDefaults: string[] }>([
        {
          type: 'multiselect',
          name: 'targetDefaults',
          message:
            'Which scripts need to be run in order? (e.g. before building a project, dependent projects must be built)',
          choices: scripts,
          /**
           * limit is missing from the interface but it limits the amount of options shown
           */
          limit: process.stdout.rows - 4, // 4 leaves room for the header above, the prompt and some whitespace
        } as any,
      ])
    ).targetDefaults;

    cacheableOperations = (
      await prompt<{ cacheableOperations: string[] }>([
        {
          type: 'multiselect',
          name: 'cacheableOperations',
          message:
            'Which scripts are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not)',
          choices: scripts,
          /**
           * limit is missing from the interface but it limits the amount of options shown
           */
          limit: process.stdout.rows - 4, // 4 leaves room for the header above, the prompt and some whitespace
        } as any,
      ])
    ).cacheableOperations;

    for (const scriptName of cacheableOperations) {
      scriptOutputs[scriptName] = (
        await prompt([
          {
            type: 'input',
            name: scriptName,
            message: `Does the "${scriptName}" script create any outputs? If not, leave blank, otherwise provide a path relative to a project root (e.g. dist, lib, build, coverage)`,
          },
        ])
      )[scriptName];
    }

    useNxCloud =
      options.nxCloud ?? (await connectExistingRepoToNxCloudPrompt());
  } else {
    targetDefaults = [];
    cacheableOperations = options.cacheable ?? [];
    useNxCloud =
      options.nxCloud ??
      (options.interactive
        ? await connectExistingRepoToNxCloudPrompt()
        : false);
  }

  createNxJsonFile(
    repoRoot,
    targetDefaults,
    cacheableOperations,
    scriptOutputs
  );

  updateGitIgnore(repoRoot);
  addDepsToPackageJson(repoRoot);

  output.log({ title: '📦 Installing dependencies' });
  runInstall(repoRoot);

  if (useNxCloud) {
    output.log({ title: '🛠️ Setting up Nx Cloud' });
    initCloud(repoRoot, 'nx-init-monorepo');
  }
}

// scanning package.json files
function allProjectPackageJsonFiles(repoRoot: string) {
  const packageJsonFiles = allPackageJsonFiles(repoRoot, repoRoot);
  return packageJsonFiles.filter((c) => c != 'package.json');
}

function allPackageJsonFiles(repoRoot: string, dirName: string) {
  const ignoredGlobs = getIgnoredGlobs(repoRoot);
  const relDirName = relative(repoRoot, dirName);
  if (
    relDirName &&
    (ignoredGlobs.ignores(relDirName) ||
      relDirName.indexOf(`node_modules`) > -1)
  ) {
    return [];
  }

  let res = [];
  try {
    readdirSync(dirName).forEach((c) => {
      const child = join(dirName, c);
      if (ignoredGlobs.ignores(relative(repoRoot, child))) {
        return;
      }
      try {
        const s = statSync(child);
        if (s.isFile() && c == 'package.json') {
          res.push(relative(repoRoot, child));
        } else if (s.isDirectory()) {
          res = [...res, ...allPackageJsonFiles(repoRoot, child)];
        }
      } catch {}
    });
  } catch {}
  return res;
}

function getIgnoredGlobs(repoRoot: string) {
  const ig = ignore();
  try {
    ig.add(readFileSync(`${repoRoot}/.gitignore`, 'utf-8'));
  } catch {}
  return ig;
}

function combineAllScriptNames(
  repoRoot: string,
  packageJsonFiles: string[]
): string[] {
  const res = new Set<string>();
  packageJsonFiles.forEach((p) => {
    const packageJson = readJsonFile(join(repoRoot, p));
    Object.keys(packageJson.scripts || {}).forEach((scriptName) =>
      res.add(scriptName)
    );
  });
  return [...res];
}
