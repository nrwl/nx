import {
  combineOptionsForGenerator,
  handleErrors,
  Options,
  Schema,
} from '../utils/params';
import { Workspaces } from '../config/workspaces';
import { FileChange, flushChanges, FsTree } from '../generators/tree';
import { logger } from '../utils/logger';
import * as chalk from 'chalk';
import { workspaceRoot } from '../utils/workspace-root';
import { NxJsonConfiguration } from '../config/nx-json';
import { printHelp } from '../utils/print-help';
import { prompt } from 'enquirer';
import { readJsonFile } from 'nx/src/utils/fileutils';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../project-graph/project-graph';
import { readNxJson } from '../config/configuration';

export interface GenerateOptions {
  collectionName: string;
  generatorName: string;
  generatorOptions: Options;
  help: boolean;
  dryRun: boolean;
  interactive: boolean;
  defaults: boolean;
}

function printChanges(fileChanges: FileChange[]) {
  fileChanges.forEach((f) => {
    if (f.type === 'CREATE') {
      console.log(`${chalk.green('CREATE')} ${f.path}`);
    } else if (f.type === 'UPDATE') {
      console.log(`${chalk.white('UPDATE')} ${f.path}`);
    } else if (f.type === 'DELETE') {
      console.log(`${chalk.yellow('DELETE')} ${f.path}`);
    }
  });
}

async function promptForCollection(
  generatorName: string,
  ws: Workspaces,
  interactive: boolean
) {
  const packageJson = readJsonFile(`${workspaceRoot}/package.json`);
  const collections = Array.from(
    new Set([
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {}),
    ])
  );
  const choicesMap = new Set<string>();

  for (const collectionName of collections) {
    try {
      const { resolvedCollectionName, normalizedGeneratorName } =
        ws.readGenerator(collectionName, generatorName);

      choicesMap.add(`${resolvedCollectionName}:${normalizedGeneratorName}`);
    } catch {}
  }

  const choices = Array.from(choicesMap);

  if (choices.length === 1) {
    return choices[0];
  } else if (!interactive && choices.length > 1) {
    throwInvalidInvocation(choices);
  } else if (interactive && choices.length > 1) {
    const noneOfTheAbove = `None of the above`;
    choices.push(noneOfTheAbove);
    let { generator, customCollection } = await prompt<{
      generator: string;
      customCollection?: string;
    }>([
      {
        name: 'generator',
        message: `Which generator would you like to use?`,
        type: 'autocomplete',
        choices,
      },
      {
        name: 'customCollection',
        type: 'input',
        message: `Which collection would you like to use?`,
        skip: function () {
          // Skip this question if the user did not answer None of the above
          return this.state.answers.generator !== noneOfTheAbove;
        },
        validate: function (value) {
          if (this.skipped) {
            return true;
          }
          try {
            ws.readGenerator(value, generatorName);
            return true;
          } catch {
            logger.error(`\nCould not find ${value}:${generatorName}`);
            return false;
          }
        },
      },
    ]);
    return customCollection
      ? `${customCollection}:${generatorName}`
      : generator;
  } else {
    throw new Error(`Could not find any generators named "${generatorName}"`);
  }
}

function parseGeneratorString(value: string): {
  collection?: string;
  generator: string;
} {
  const separatorIndex = value.lastIndexOf(':');

  if (separatorIndex > 0) {
    return {
      collection: value.slice(0, separatorIndex),
      generator: value.slice(separatorIndex + 1),
    };
  } else {
    return {
      generator: value,
    };
  }
}

async function convertToGenerateOptions(
  generatorOptions: { [p: string]: any },
  ws: Workspaces,
  defaultCollectionName: string,
  mode: 'generate' | 'new'
): Promise<GenerateOptions> {
  let collectionName: string | null = null;
  let generatorName: string | null = null;
  const interactive = generatorOptions.interactive as boolean;

  if (mode === 'generate') {
    const generatorDescriptor = generatorOptions['generator'] as string;
    const { collection, generator } = parseGeneratorString(generatorDescriptor);

    if (collection) {
      collectionName = collection;
      generatorName = generator;
    } else if (!defaultCollectionName) {
      const generatorString = await promptForCollection(
        generatorDescriptor,
        ws,
        interactive
      );
      const parsedGeneratorString = parseGeneratorString(generatorString);
      collectionName = parsedGeneratorString.collection;
      generatorName = parsedGeneratorString.generator;
    } else {
      collectionName = defaultCollectionName;
      generatorName = generatorDescriptor;
    }
  } else {
    collectionName = generatorOptions.collection as string;
    generatorName = 'new';
  }

  if (!collectionName) {
    throwInvalidInvocation(['@nrwl/workspace:library']);
  }

  const res = {
    collectionName,
    generatorName,
    generatorOptions,
    help: generatorOptions.help as boolean,
    dryRun: generatorOptions.dryRun as boolean,
    interactive,
    defaults: generatorOptions.defaults as boolean,
  };

  delete generatorOptions.d;
  delete generatorOptions.dryRun;
  delete generatorOptions['dry-run'];
  delete generatorOptions.interactive;
  delete generatorOptions.help;
  delete generatorOptions.collection;
  delete generatorOptions.verbose;
  delete generatorOptions.generator;
  delete generatorOptions['--'];
  delete generatorOptions['$0'];

  return res;
}

function throwInvalidInvocation(availableGenerators: string[]) {
  throw new Error(
    `Specify the generator name (e.g., nx generate ${availableGenerators.join(
      ', '
    )})`
  );
}

function readDefaultCollection(nxConfig: NxJsonConfiguration) {
  return nxConfig.cli ? nxConfig.cli.defaultCollection : null;
}

export function printGenHelp(
  opts: GenerateOptions,
  schema: Schema,
  normalizedGeneratorName: string,
  aliases: string[]
) {
  printHelp(
    `generate ${opts.collectionName}:${normalizedGeneratorName}`,
    {
      ...schema,
      properties: schema.properties,
    },
    {
      mode: 'generate',
      plugin: opts.collectionName,
      entity: normalizedGeneratorName,
      aliases,
    }
  );
}

export async function newWorkspace(cwd: string, args: { [k: string]: any }) {
  const ws = new Workspaces(null);
  const isVerbose = args['verbose'];

  return handleErrors(isVerbose, async () => {
    const opts = await convertToGenerateOptions(args, ws, null, 'new');
    const { normalizedGeneratorName, schema, implementationFactory } =
      ws.readGenerator(opts.collectionName, opts.generatorName);

    logger.info(
      `NX Generating ${opts.collectionName}:${normalizedGeneratorName}`
    );

    const combinedOpts = await combineOptionsForGenerator(
      opts.generatorOptions,
      opts.collectionName,
      normalizedGeneratorName,
      null,
      schema,
      opts.interactive,
      null,
      null,
      isVerbose
    );

    if (ws.isNxGenerator(opts.collectionName, normalizedGeneratorName)) {
      const host = new FsTree(cwd, isVerbose);
      const implementation = implementationFactory();
      const task = await implementation(host, combinedOpts);
      const changes = host.listChanges();

      printChanges(changes);
      if (!opts.dryRun) {
        flushChanges(cwd, changes);
        if (task) {
          await task();
        }
      } else {
        logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
      }
    } else {
      return (await import('../adapter/ngcli-adapter')).generate(
        cwd,
        {
          ...opts,
          generatorOptions: combinedOpts,
        },
        isVerbose
      );
    }
  });
}

export async function generate(cwd: string, args: { [k: string]: any }) {
  const ws = new Workspaces(workspaceRoot);
  const nxJson = readNxJson();
  const projectGraph = await createProjectGraphAsync();
  const workspaceConfiguration =
    readProjectsConfigurationFromProjectGraph(projectGraph);
  const isVerbose = args['verbose'];

  return handleErrors(isVerbose, async () => {
    const opts = await convertToGenerateOptions(
      args,
      ws,
      readDefaultCollection(nxJson),
      'generate'
    );
    const { normalizedGeneratorName, schema, implementationFactory, aliases } =
      ws.readGenerator(opts.collectionName, opts.generatorName);

    logger.info(
      `NX Generating ${opts.collectionName}:${normalizedGeneratorName}`
    );

    if (opts.help) {
      printGenHelp(opts, schema, normalizedGeneratorName, aliases);
      return 0;
    }

    const combinedOpts = await combineOptionsForGenerator(
      opts.generatorOptions,
      opts.collectionName,
      normalizedGeneratorName,
      workspaceConfiguration,
      schema,
      opts.interactive,
      ws.calculateDefaultProjectName(cwd, workspaceConfiguration),
      ws.relativeCwd(cwd),
      isVerbose
    );

    if (ws.isNxGenerator(opts.collectionName, normalizedGeneratorName)) {
      const host = new FsTree(workspaceRoot, isVerbose);
      const implementation = implementationFactory();
      const task = await implementation(host, combinedOpts);
      const changes = host.listChanges();

      printChanges(changes);
      if (!opts.dryRun) {
        flushChanges(workspaceRoot, changes);
        if (task) {
          await task();
        }
      } else {
        logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
      }
    } else {
      require('../adapter/compat');
      return (await import('../adapter/ngcli-adapter')).generate(
        workspaceRoot,
        {
          ...opts,
          generatorOptions: combinedOpts,
        },
        isVerbose
      );
    }
  });
}
