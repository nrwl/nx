import * as yargsParser from 'yargs-parser';
import {
  combineOptionsForGenerator,
  convertToCamelCase,
  handleErrors,
  Options,
  Schema,
} from '../shared/params';
import { printHelp } from '../shared/print-help';
import { Workspaces } from '../shared/workspace';
import { FileChange, flushChanges, FsTree } from '../shared/tree';
import { logger } from '../shared/logger';
import * as chalk from 'chalk';
import { NxJsonConfiguration } from '../shared/nx';

export interface GenerateOptions {
  collectionName: string;
  generatorName: string;
  generatorOptions: Options;
  help: boolean;
  debug: boolean;
  dryRun: boolean;
  force: boolean;
  interactive: boolean;
  defaults: boolean;
}

function throwInvalidInvocation() {
  throw new Error(
    `Specify the generator name (e.g., nx generate @nrwl/workspace:library)`
  );
}

function parseGenerateOpts(
  args: string[],
  mode: 'generate' | 'new',
  defaultCollection: string | null
): GenerateOptions {
  const generatorOptions = convertToCamelCase(
    yargsParser(args, {
      boolean: ['help', 'dryRun', 'debug', 'force', 'interactive', 'defaults'],
      alias: {
        dryRun: 'dry-run',
        d: 'dryRun',
      },
      default: {
        debug: false,
        dryRun: false,
        interactive: true,
      },
    })
  );

  // TODO: vsavkin remove defaults in Nx 13
  if (generatorOptions.defaults) {
    logger.warn(
      `Use --no-interactive instead of --defaults. The --defaults option will be removed in Nx 13.`
    );
    generatorOptions.interactive = false;
  }

  let collectionName: string | null = null;
  let generatorName: string | null = null;
  if (mode === 'generate') {
    if (
      !generatorOptions['_'] ||
      (generatorOptions['_'] as string[]).length === 0
    ) {
      throwInvalidInvocation();
    }
    const generatorDescriptor = (generatorOptions['_'] as string[]).shift();
    const separatorIndex = generatorDescriptor.lastIndexOf(':');

    if (separatorIndex > 0) {
      collectionName = generatorDescriptor.substr(0, separatorIndex);
      generatorName = generatorDescriptor.substr(separatorIndex + 1);
    } else {
      collectionName = defaultCollection;
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
    debug: generatorOptions.debug as boolean,
    dryRun: generatorOptions.dryRun as boolean,
    force: generatorOptions.force as boolean,
    interactive: generatorOptions.interactive as boolean,
    defaults: generatorOptions.defaults as boolean,
  };

  delete generatorOptions.debug;
  delete generatorOptions.d;
  delete generatorOptions.dryRun;
  delete generatorOptions.force;
  delete generatorOptions.interactive;
  delete generatorOptions.defaults;
  delete generatorOptions.help;
  delete generatorOptions.collection;
  delete generatorOptions['--'];

  return res;
}

export function printGenHelp(opts: GenerateOptions, schema: Schema) {
  printHelp(`nx generate ${opts.collectionName}:${opts.generatorName}`, {
    ...schema,
    properties: {
      ...schema.properties,
      dryRun: {
        type: 'boolean',
        default: false,
        description: `Runs through and reports activity without writing to disk.`,
      },
    },
  });
}

function readDefaultCollection(nxConfig: NxJsonConfiguration) {
  return nxConfig.cli ? nxConfig.cli.defaultCollection : null;
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

export async function taoNew(cwd: string, args: string[], isVerbose = false) {
  const ws = new Workspaces(null);
  return handleErrors(isVerbose, async () => {
    const opts = parseGenerateOpts(args, 'new', null);

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
      return (await import('./ngcli-adapter')).generate(
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

export async function generate(
  cwd: string,
  root: string,
  args: string[],
  isVerbose = false
) {
  const ws = new Workspaces(root);

  return handleErrors(isVerbose, async () => {
    const workspaceDefinition = ws.readWorkspaceConfiguration();
    const opts = parseGenerateOpts(
      args,
      'generate',
      readDefaultCollection(workspaceDefinition)
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
      const host = new FsTree(root, isVerbose);
      const implementation = implementationFactory();
      const task = await implementation(host, combinedOpts);
      const changes = host.listChanges();

      printChanges(changes);
      if (!opts.dryRun) {
        flushChanges(root, changes);
        if (task) {
          await task();
        }
      } else {
        logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
      }
    } else {
      require('../compat/compat');
      return (await import('./ngcli-adapter')).generate(
        root,
        {
          ...opts,
          generatorOptions: combinedOpts,
        },
        isVerbose
      );
    }
  });
}
