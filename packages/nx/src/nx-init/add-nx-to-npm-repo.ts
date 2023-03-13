import { output } from '../utils/output';
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
import { joinPathFragments } from '../utils/path';
import { PackageJson } from '../utils/package-json';
import {
  getPackageManagerCommand,
  PackageManagerCommands,
} from '../utils/package-manager';

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

    useCloud = await askAboutNxCloud();
  } else {
    cacheableOperations = parsedArgs.cacheable
      ? parsedArgs.cacheable.split(',')
      : [];
    useCloud = false;
  }

  createNxJsonFile(repoRoot, [], cacheableOperations, {});

  const pmc = getPackageManagerCommand();

  addDepsToPackageJson(repoRoot, useCloud);
  markRootPackageJsonAsNxProject(
    repoRoot,
    cacheableOperations,
    scriptOutputs,
    pmc
  );

  output.log({ title: `📦 Installing dependencies` });

  runInstall(repoRoot, pmc);

  if (useCloud) {
    initCloud(repoRoot, 'nx-init-npm-repo');
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
  scriptOutputs: { [script: string]: string },
  pmc: PackageManagerCommands
) {
  const json = readJsonFile<PackageJson>(
    joinPathFragments(repoRoot, `package.json`)
  );
  json.nx = { targets: {} };
  for (let script of Object.keys(scriptOutputs)) {
    if (scriptOutputs[script]) {
      json.nx.targets[script] = {
        outputs: [`{projectRoot}/${scriptOutputs[script]}`],
      };
    }
  }
  for (let script of cacheableScripts) {
    const scriptDefinition = json.scripts[script];
    if (!scriptDefinition) {
      continue;
    }

    if (scriptDefinition.includes('&&') || scriptDefinition.includes('||')) {
      let backingScriptName = `_${script}`;
      json.scripts[backingScriptName] = scriptDefinition;
      json.scripts[script] = `nx exec -- ${pmc.run(backingScriptName, '')}`;
    } else {
      json.scripts[script] = `nx exec -- ${json.scripts[script]}`;
    }
  }
  writeJsonFile(`package.json`, json);
}
