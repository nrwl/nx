import { output } from '../utils/output';
import { getPackageManagerCommand } from '../utils/package-manager';
import * as yargsParser from 'yargs-parser';
import * as enquirer from 'enquirer';
import { readJsonFile, writeJsonFile } from '../utils/fileutils';
import {
  addDepsToPackageJson,
  askAboutNxCloud,
  createNxJsonFile,
  initCloud,
  runInstall,
} from './utils';
import { joinPathFragments } from 'nx/src/utils/path';

const parsedArgs = yargsParser(process.argv, {
  boolean: ['yes'],
  string: ['cacheable'], // only used for testing
  alias: {
    yes: ['y'],
  },
});

export async function addNxToNpmRepo() {
  const repoRoot = process.cwd();

  output.log({ title: `🐳 Nx initialization` });

  let cacheableOperations: string[];
  let scriptOutputs = {};
  let useCloud: boolean;

  const packageJson = readJsonFile('package.json');
  const scripts = Object.keys(packageJson.scripts).filter(
    (s) => !s.startsWith('pre') && !s.startsWith('post')
  );

  if (parsedArgs.yes !== true) {
    output.log({
      title: `🧑‍🔧 Please answer the following questions about the scripts found in your package.json in order to generate task runner configuration`,
    });

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

    useCloud = await askAboutNxCloud();
  } else {
    cacheableOperations = parsedArgs.cacheable
      ? parsedArgs.cacheable.split(',')
      : [];
    useCloud = false;
  }

  createNxJsonFile(repoRoot, [], cacheableOperations, {}, packageJson.name);

  addDepsToPackageJson(repoRoot, useCloud);
  markRootPackageJsonAsNxProject(repoRoot, cacheableOperations, scriptOutputs);

  output.log({ title: `📦 Installing dependencies` });

  runInstall(repoRoot);

  if (useCloud) {
    initCloud(repoRoot);
  }

  printFinalMessage();
}

function printFinalMessage() {
  output.success({
    title: `🎉 Done!`,
    bodyLines: [
      `- Enabled computation caching!`,
      `- Learn more at https://nx.dev/recipes/adopting-nx/adding-to-monorepo`,
    ],
  });
}

export function markRootPackageJsonAsNxProject(
  repoRoot: string,
  cacheableScripts: string[],
  scriptOutputs: { [script: string]: string }
) {
  const json = readJsonFile(joinPathFragments(repoRoot, `package.json`));
  json.nx = { targets: {} };
  for (let script of Object.keys(scriptOutputs)) {
    if (scriptOutputs[script]) {
      json.nx.targets[script] = {
        outputs: [`{projectRoot}/${scriptOutputs[script]}`],
      };
    }
  }
  for (let script of cacheableScripts) {
    if (json.scripts[script]) {
      json.scripts[script] = `nx exec -- ${json.scripts[script]}`;
    }
  }
  writeJsonFile(`package.json`, json);
}
