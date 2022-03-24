import {
  combineOptionsForGenerator,
  handleErrors,
  Options,
  Schema,
} from '../utils/params';
import { Workspaces } from '../shared/workspace';
import { FileChange, flushChanges, FsTree } from '../shared/tree';
import { logger } from '../utils/logger';
import * as chalk from 'chalk';
import { workspaceRoot } from 'nx/src/utils/app-root';
import { NxJsonConfiguration } from 'nx/src/shared/nx';
import { printHelp } from 'nx/src/utils/print-help';

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

function convertToGenerateOptions(
  generatorOptions: { [k: string]: any },
  defaultCollectionName: string,
  mode: 'generate' | 'new'
): GenerateOptions {
  let collectionName: string | null = null;
  let generatorName: string | null = null;

  if (mode === 'generate') {
    const generatorDescriptor = generatorOptions['generator'] as string;
    const separatorIndex = generatorDescriptor.lastIndexOf(':');

    if (separatorIndex > 0) {
      collectionName = generatorDescriptor.substr(0, separatorIndex);
      generatorName = generatorDescriptor.substr(separatorIndex + 1);
    } else {
      collectionName = defaultCollectionName;
      generatorName = generatorDescriptor;
    }
  } else {
    collectionName = generatorOptions.collection as string;
    generatorName = 'new';
  }

  if (!collectionName) {
    throwInvalidInvocation();
  }

  const res = {
    collectionName,
    generatorName,
    generatorOptions,
    help: generatorOptions.help as boolean,
    dryRun: generatorOptions.dryRun as boolean,
    interactive: generatorOptions.interactive as boolean,
    defaults: generatorOptions.defaults as boolean,
  };

  delete generatorOptions.d;
  delete generatorOptions.dryRun;
  delete generatorOptions.interactive;
  delete generatorOptions.help;
  delete generatorOptions.collection;
  delete generatorOptions.verbose;
  delete generatorOptions.generator;
  delete generatorOptions['--'];
  delete generatorOptions['$0'];

  return res;
}

function throwInvalidInvocation() {
  throw new Error(
    `Specify the generator name (e.g., nx generate @nrwl/workspace:library)`
  );
}

function readDefaultCollection(nxConfig: NxJsonConfiguration) {
  return nxConfig.cli ? nxConfig.cli.defaultCollection : null;
}

export function printGenHelp(opts: GenerateOptions, schema: Schema) {
  printHelp(
    `nx generate ${opts.collectionName}:${opts.generatorName}`,
    {
      ...schema,
      properties: schema.properties,
    },
    {
      mode: 'generate',
      plugin: opts.collectionName,
      entity: opts.generatorName,
    }
  );
}

export async function newWorkspace(cwd: string, args: { [k: string]: any }) {
  const ws = new Workspaces(null);
  const isVerbose = args['verbose'];

  return handleErrors(isVerbose, async () => {
    const opts = convertToGenerateOptions(args, null, 'new');
    const { normalizedGeneratorName, schema, implementationFactory } =
      ws.readGenerator(opts.collectionName, opts.generatorName);

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
  const isVerbose = args['verbose'];

  return handleErrors(isVerbose, async () => {
    const workspaceDefinition = ws.readWorkspaceConfiguration();
    const opts = convertToGenerateOptions(
      args,
      readDefaultCollection(workspaceDefinition),
      'generate'
    );
    const { normalizedGeneratorName, schema, implementationFactory } =
      ws.readGenerator(opts.collectionName, opts.generatorName);

    if (opts.help) {
      printGenHelp(opts, schema);
      return 0;
    }

    const combinedOpts = await combineOptionsForGenerator(
      opts.generatorOptions,
      opts.collectionName,
      normalizedGeneratorName,
      workspaceDefinition,
      schema,
      opts.interactive,
      ws.calculateDefaultProjectName(cwd, workspaceDefinition),
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
