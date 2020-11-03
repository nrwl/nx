import * as minimist from 'minimist';
import { getLogger } from '../shared/logger';
import {
  combineOptionsForSchematic,
  convertToCamelCase,
  handleErrors,
  Options,
  Schema,
} from '../shared/params';
import { commandName, printHelp } from '../shared/print-help';
import { WorkspaceDefinition, Workspaces } from '../shared/workspace';
import { statSync, unlinkSync, writeFileSync } from 'fs';
import { mkdirpSync, rmdirSync } from 'fs-extra';
import * as path from 'path';
import { FileChange, FsTree } from '../shared/tree';

const chalk = require('chalk');

export interface GenerateOptions {
  collectionName: string;
  schematicName: string;
  schematicOptions: Options;
  help: boolean;
  debug: boolean;
  dryRun: boolean;
  force: boolean;
  interactive: boolean;
  defaults: boolean;
}

function throwInvalidInvocation() {
  throw new Error(
    `Specify the schematic name (e.g., ${commandName} generate collection-name:schematic-name)`
  );
}

function parseGenerateOpts(
  args: string[],
  mode: 'generate' | 'new',
  defaultCollection: string | null
): GenerateOptions {
  const schematicOptions = convertToCamelCase(
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
  let schematicName: string | null = null;
  if (mode === 'generate') {
    if (
      !schematicOptions['_'] ||
      (schematicOptions['_'] as string[]).length === 0
    ) {
      throwInvalidInvocation();
    }
    [collectionName, schematicName] = (schematicOptions['_'] as string[])
      .shift()
      .split(':');
    if (!schematicName) {
      schematicName = collectionName;
      collectionName = defaultCollection;
    }
  } else {
    collectionName = schematicOptions.collection as string;
    schematicName = '';
  }

  if (!collectionName) {
    throwInvalidInvocation();
  }

  const res = {
    collectionName,
    schematicName,
    schematicOptions,
    help: schematicOptions.help as boolean,
    debug: schematicOptions.debug as boolean,
    dryRun: schematicOptions.dryRun as boolean,
    force: schematicOptions.force as boolean,
    interactive: schematicOptions.interactive as boolean,
    defaults: schematicOptions.defaults as boolean,
  };

  delete schematicOptions.debug;
  delete schematicOptions.d;
  delete schematicOptions.dryRun;
  delete schematicOptions.force;
  delete schematicOptions.interactive;
  delete schematicOptions.defaults;
  delete schematicOptions.help;
  delete schematicOptions['--'];

  return res;
}

export function printGenHelp(
  opts: GenerateOptions,
  schema: Schema,
  logger: Console
) {
  printHelp(
    `${commandName} generate ${opts.collectionName}:${opts.schematicName}`,
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
    const workspaceDefinition = await ws.readWorkspaceConfiguration(root);
    const opts = parseGenerateOpts(
      args,
      'generate',
      readDefaultCollection(workspaceDefinition)
    );

    if (ws.isNxSchematic(opts.collectionName, opts.schematicName)) {
      const { schema, implementation } = ws.readSchematic(
        opts.collectionName,
        opts.schematicName
      );

      if (opts.help) {
        printGenHelp(opts, schema, logger as any);
        return 0;
      }

      const combinedOpts = await combineOptionsForSchematic(
        opts.schematicOptions,
        opts.collectionName,
        opts.schematicName,
        workspaceDefinition,
        schema,
        opts.interactive
      );
      const host = new FsTree(root, isVerbose, logger);
      await implementation(combinedOpts)(host);
      const changes = host.listChanges();

      printChanges(changes);
      if (!opts.dryRun) {
        flushChanges(root, changes);
      } else {
        logger.warn(`\nNOTE: The "dryRun" flag means no changes were made.`);
      }
    } else {
      return (await import('./ngcli-adapter')).generate(logger, root, opts);
    }
  });
}
