import * as enquirer from 'enquirer';
import { InitArgs } from '../init';
import { readJsonFile } from '../../../utils/fileutils';
import { output } from '../../../utils/output';
import { getPackageManagerCommand } from '../../../utils/package-manager';
import {
  addDepsToPackageJson,
  askAboutNxCloud,
  createNxJsonFile,
  initCloud,
  markRootPackageJsonAsNxProject,
  printFinalMessage,
  runInstall,
} from './utils';

type Options = Pick<InitArgs, 'nxCloud' | 'interactive' | 'cacheable'>;

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
      (await enquirer.prompt([
        {
          type: 'multiselect',
          name: 'cacheableOperations',
          message:
            'Which of the following scripts are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not). You can use spacebar to select one or more scripts.',
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
            message: `Does the "${scriptName}" script create any outputs? If not, leave blank, otherwise provide a path (e.g. dist, lib, build, coverage)`,
          },
        ])
      )[scriptName];
    }

    useNxCloud = options.nxCloud ?? (await askAboutNxCloud());
  } else {
    cacheableOperations = options.cacheable ?? [];
    useNxCloud =
      options.nxCloud ??
      (options.interactive ? await askAboutNxCloud() : false);
  }

  createNxJsonFile(repoRoot, [], cacheableOperations, {});

  const pmc = getPackageManagerCommand();

  addDepsToPackageJson(repoRoot, useNxCloud);
  markRootPackageJsonAsNxProject(
    repoRoot,
    cacheableOperations,
    scriptOutputs,
    pmc
  );

  output.log({ title: '📦 Installing dependencies' });

  runInstall(repoRoot, pmc);

  if (useNxCloud) {
    output.log({ title: '🛠️ Setting up Nx Cloud' });
    initCloud(repoRoot, 'nx-init-npm-repo');
  }

  printFinalMessage({
    learnMoreLink:
      'https://nx.dev/recipes/adopting-nx/adding-to-existing-project',
  });
}
