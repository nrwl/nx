import * as minimist from 'minimist';
import { getLogger } from '../shared/logger';
import {
  combineOptionsForGenerator,
  convertToCamelCase,
  handleErrors,
  Options,
  Schema,
} from '../shared/params';
import { printHelp } from '../shared/print-help';
import { WorkspaceDefinition, Workspaces } from '../shared/workspace';
import { statSync, unlinkSync, writeFileSync } from 'fs';
import { mkdirpSync, rmdirSync } from 'fs-extra';
import * as path from 'path';
import { FileChange, FsTree } from '../shared/tree';

const chalk = require('chalk');

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
    minimist(args, {
      boolean: ['help', 'dryRun', 'debug', 'force', 'interactive'],
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

  let collectionName: string | null = null;
  let generatorName: string | null = null;
  if (mode === 'generate') {
    if (
      !generatorOptions['_'] ||
      (generatorOptions['_'] as string[]).length === 0
    ) {
      throwInvalidInvocation();
    }
    [collectionName, generatorName] = (generatorOptions['_'] as string[])
      .shift()
      .split(':');
    if (!generatorName) {
      generatorName = collectionName;
      collectionName = defaultCollection;
    }
  } else {
    collectionName = generatorOptions.collection as string;
    generatorName = '';
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
  delete generatorOptions['--'];

  return res;
}

export function printGenHelp(
  opts: GenerateOptions,
  schema: Schema,
  logger: Console
) {
  printHelp(
    `nx generate ${opts.collectionName}:${opts.generatorName}`,
    {
      ...schema,
      properties: {
        ...schema.properties,
        dryRun: {
          type: 'boolean',
          default: false,
          description: `Runs through and reports activity without writing to disk.`,
        },
      },
    },
    logger as any
  );
}

function readDefaultCollection(workspace: WorkspaceDefinition) {
  return workspace.cli ? workspace.cli.defaultCollection : null;
}

export function flushChanges(root: string, fileChanges: FileChange[]) {
  fileChanges.forEach((f) => {
    const fpath = path.join(root, f.path);
    if (f.type === 'CREATE') {
      mkdirpSync(path.dirname(fpath));
      writeFileSync(fpath, f.content);
    } else if (f.type === 'UPDATE') {
      writeFileSync(fpath, f.content);
    } else if (f.type === 'DELETE') {
      try {
        const stat = statSync(fpath);
        if (stat.isDirectory()) {
          rmdirSync(fpath, { recursive: true });
        } else {
          unlinkSync(fpath);
        }
      } catch (e) {}
    }
  });
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

export async function taoNew(root: string, args: string[], isVerbose = false) {
  const logger = getLogger(isVerbose);
  return handleErrors(logger, isVerbose, async () => {
    const opts = parseGenerateOpts(args, 'new', null);
    return (await import('./ngcli-adapter')).invokeNew(logger, root, opts);
  });
}

export async function generate(
  root: string,
  args: string[],
  isVerbose = false
) {
  const logger = getLogger(isVerbose);
  const ws = new Workspaces();

  return handleErrors(logger, isVerbose, async () => {
    const workspaceDefinition = ws.readWorkspaceConfiguration(root);
    const opts = parseGenerateOpts(
      args,
      'generate',
      readDefaultCollection(workspaceDefinition)
    );

    if (ws.isNxGenerator(opts.collectionName, opts.generatorName)) {
      const { schema, implementation } = ws.readGenerator(
        opts.collectionName,
        opts.generatorName
      );

      if (opts.help) {
        printGenHelp(opts, schema, logger as any);
        return 0;
      }

      const combinedOpts = await combineOptionsForGenerator(
        opts.generatorOptions,
        opts.collectionName,
        opts.generatorName,
        workspaceDefinition,
        schema,
        opts.interactive
      );
      const host = new FsTree(root, isVerbose, logger);
      const task = await implementation(host, combinedOpts);
      const changes = host.listChanges();

      printChanges(changes);
      if (!opts.dryRun) {
        flushChanges(root, changes);
        if (task) {
          await task(host);
        }
      } else {
        logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
      }
    } else {
      return (await import('./ngcli-adapter')).generate(logger, root, opts);
    }
  });
}
