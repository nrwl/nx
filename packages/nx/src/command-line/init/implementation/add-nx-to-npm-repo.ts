import * as enquirer from 'enquirer';
import { join } from 'path';
import { InitArgs } from '../init-v1';
import { readJsonFile } from '../../../utils/fileutils';
import { output } from '../../../utils/output';
import { getPackageManagerCommand } from '../../../utils/package-manager';
import {
  addDepsToPackageJson,
  createNxJsonFile,
  initCloud,
  markPackageJsonAsNxProject,
  markRootPackageJsonAsNxProjectLegacy,
  runInstall,
  updateGitIgnore,
} from './utils';
import { connectExistingRepoToNxCloudPrompt } from '../../connect/connect-to-nx-cloud';

type Options = Pick<InitArgs, 'nxCloud' | 'interactive' | 'cacheable'> & {
  legacy?: boolean;
};

export async function addNxToNpmRepo(options: Options) {
  const repoRoot = process.cwd();

  output.log({ title: '🐳 Nx initialization' });

  let cacheableOperations: string[];
  let scriptOutputs = {};
  let useNxCloud: boolean;

  const packageJson = readJsonFile('package.json');
  const scripts = Object.keys(packageJson.scripts ?? {}).filter(
    (s) => !s.startsWith('pre') && !s.startsWith('post')
  );

  if (options.interactive && scripts.length > 0) {
    output.log({
      title:
        '🧑‍🔧 Please answer the following questions about the scripts found in your package.json in order to generate task runner configuration',
    });

    cacheableOperations = (
      await enquirer.prompt<{ cacheableOperations: string[] }>([
        {
          type: 'multiselect',
          name: 'cacheableOperations',
          message:
            'Which of the following scripts are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not). You can use spacebar to select one or more scripts.',
          choices: scripts,
          /**
           * limit is missing from the interface but it limits the amount of options shown
           */
          limit: process.stdout.rows - 4, // 4 leaves room for the header above, the prompt and some whitespace
        } as any,
      ])
    ).cacheableOperations;

    for (const scriptName of cacheableOperations) {
      // eslint-disable-next-line no-await-in-loop
      scriptOutputs[scriptName] = (
        await enquirer.prompt([
          {
            type: 'input',
            name: scriptName,
            message: `Does the "${scriptName}" script create any outputs? If not, leave blank, otherwise provide a path (e.g. dist, lib, build, coverage)`,
          },
        ])
      )[scriptName];
    }

    useNxCloud =
      options.nxCloud ?? (await connectExistingRepoToNxCloudPrompt());
  } else {
    cacheableOperations = options.cacheable ?? [];
    useNxCloud =
      options.nxCloud ??
      (options.interactive
        ? await connectExistingRepoToNxCloudPrompt()
        : false);
  }

  createNxJsonFile(repoRoot, [], cacheableOperations, scriptOutputs);

  const pmc = getPackageManagerCommand();

  updateGitIgnore(repoRoot);
  addDepsToPackageJson(repoRoot);
  if (options.legacy) {
    markRootPackageJsonAsNxProjectLegacy(repoRoot, cacheableOperations, pmc);
  } else {
    markPackageJsonAsNxProject(join(repoRoot, 'package.json'));
  }

  output.log({ title: '📦 Installing dependencies' });

  runInstall(repoRoot, pmc);

  if (useNxCloud) {
    output.log({ title: '🛠️ Setting up Nx Cloud' });
    initCloud(repoRoot, 'nx-init-npm-repo');
  }
}
