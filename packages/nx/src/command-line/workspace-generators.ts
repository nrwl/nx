import * as chalk from 'chalk';
import { execSync } from 'child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'fs';
import {
  copySync,
  emptyDirSync,
  ensureDirSync,
  removeSync,
  writeFileSync,
} from 'fs-extra';
import { lock, unlock } from 'lockfile';
import { sha1 } from 'object-hash';
import * as path from 'path';
import type { CompilerOptions } from 'typescript';
import * as yargsParser from 'yargs-parser';
import { getFileHashes, getGitHashForFiles } from '../hasher/git-hasher';
import { fileExists, readJsonFile, writeJsonFile } from '../utils/fileutils';
import { logger } from '../utils/logger';
import { output } from '../utils/output';
import { getPackageManagerCommand } from '../utils/package-manager';
import { normalizePath } from '../utils/path';
import { workspaceRoot } from '../utils/workspace-root';
import { generate } from './generate';
import { parserConfiguration } from './nx-commands';

const rootDirectory = workspaceRoot;
const toolsDir = path.join(rootDirectory, 'tools');
const generatorsDir = path.join(toolsDir, 'generators');
const toolsTsConfigPath = path.join(toolsDir, 'tsconfig.tools.json');

type TsConfig = {
  extends: string;
  compilerOptions: CompilerOptions;
  files?: string[];
  include?: string[];
  exclude?: string[];
  references?: Array<{ path: string }>;
};

export async function workspaceGenerators(args: string[]): Promise<void> {
  const outDir = await compileTools();
  const collectionFile = path.join(outDir, 'workspace-generators.json');
  const parsedArgs = parseOptions(args, outDir, collectionFile);
  if (parsedArgs.listGenerators) {
    listGenerators(collectionFile);
  } else {
    process.exitCode = await generate(process.cwd(), parsedArgs);
  }
}

async function takeLock(lockFile: string): Promise<boolean> {
  let resolve: (value: boolean) => void;
  const result = new Promise<boolean>((_resolve, _reject) => {
    resolve = _resolve;
  });
  lock(
    lockFile,
    { retries: 60, retryWait: 1000, stale: 3 * 60 * 1000 },
    (err: any) => {
      resolve(!err);
    }
  );
  return result;
}

async function releaseLock(lockFile: string): Promise<boolean> {
  let resolve: (value: boolean) => void;
  const result = new Promise<boolean>((_resolve, _reject) => {
    resolve = _resolve;
  });
  unlock(lockFile, (err: any) => {
    resolve(!err);
  });
  return result;
}

function globalFiles() {
  const files = [];
  const candidates = ['package.json', 'package-lock.json', 'yarn.lock'];
  for (const file of candidates) {
    if (lstatSync(file, { throwIfNoEntry: false })) {
      files.push(file);
    }
  }
  return files;
}

async function generatorsDirHash(): Promise<string> {
  const hashes = new Map<string, string>();
  const generatorsHashes = (await getFileHashes(generatorsDir)).allFiles;
  const globalHashes = (await getGitHashForFiles(globalFiles(), rootDirectory))
    .hashes;
  generatorsHashes.forEach((hash: string, filename: string) => {
    hashes.set(filename, hash);
  });
  globalHashes.forEach((hash: string, filename: string) => {
    hashes.set(filename, hash);
  });
  return sha1(hashes);
}

// compile tools
async function compileTools() {
  const toolsOutDir = getToolsOutDir();
  const generatorsOutDir = path.join(toolsOutDir, 'generators');
  const hashPath = path.join(toolsOutDir, '.hash');
  const toolsLockFile = path.join(
    path.dirname(toolsOutDir),
    `.${path.basename(toolsOutDir)}.lock`
  );
  // if toolsOutDir is dist/out-tsc/tools
  // then we use dist/out-tsc/.tools.lock as a lock file
  // to ensure only one thread is building the toolsdir at a time
  let hashHasChanged = true;
  let locked = false;
  const currentHash = await generatorsDirHash();

  try {
    try {
      ensureDirSync(path.dirname(toolsOutDir));
      locked = await takeLock(toolsLockFile);
      if (locked) {
        // OK we got the lock so trust no-one else will
        // change the .hash file
        const storedHash = readFileSync(hashPath, 'ascii');
        hashHasChanged = storedHash !== currentHash;
      }
    } catch (_err: any) {}

    if (hashHasChanged) {
      // either we got the lock (locked) and the hash differed
      // or we did not get the lock, so to be on the safe side
      // just compile the generators
      emptyDirSync(toolsOutDir);
      compileToolsDir(toolsOutDir);

      const collectionData = constructCollection();
      writeJsonFile(
        path.join(generatorsOutDir, 'workspace-generators.json'),
        collectionData
      );
      writeFileSync(hashPath, currentHash);
    }
  } finally {
    // if we took the lock then release it again
    // if we did not get the lock it will become stale soon
    // and next time takeLock() will take over the stale
    // lock file and then it will be released
    if (locked) {
      await releaseLock(toolsLockFile);
    }
  }
  return Promise.resolve(generatorsOutDir);
}

function getToolsOutDir() {
  const outDir = toolsTsConfig().compilerOptions.outDir;

  if (!outDir) {
    logger.error(`${toolsTsConfigPath} must specify an outDir`);
    process.exit(1);
  }

  return path.resolve(toolsDir, outDir);
}

function compileToolsDir(outDir: string) {
  copySync(generatorsDir, path.join(outDir, 'generators'));

  const tmpTsConfigPath = createTmpTsConfig(toolsTsConfigPath, {
    include: [path.join(generatorsDir, '**/*.ts')],
  });

  const pmc = getPackageManagerCommand();
  const tsc = `${pmc.exec} tsc`;
  try {
    execSync(`${tsc} -p ${tmpTsConfigPath}`, {
      stdio: 'inherit',
      cwd: rootDirectory,
    });
  } catch {
    process.exit(1);
  }
}

function constructCollection() {
  const generators = {};
  readdirSync(generatorsDir).forEach((c) => {
    const childDir = path.join(generatorsDir, c);
    if (existsSync(path.join(childDir, 'schema.json'))) {
      generators[c] = {
        factory: `./${c}`,
        schema: `./${normalizePath(path.join(c, 'schema.json'))}`,
        description: `Schematic ${c}`,
      };
    }
  });
  return {
    name: 'workspace-generators',
    version: '1.0',
    generators,
    schematics: generators,
  };
}

function toolsTsConfig(): TsConfig {
  return readJsonFile<TsConfig>(toolsTsConfigPath);
}

function listGenerators(collectionFile: string) {
  try {
    const bodyLines: string[] = [];

    const collection = readJsonFile(collectionFile);

    bodyLines.push(chalk.bold(chalk.green('WORKSPACE GENERATORS')));
    bodyLines.push('');
    bodyLines.push(
      ...Object.entries(collection.generators).map(
        ([schematicName, schematicMeta]: [string, any]) => {
          return `${chalk.bold(schematicName)} : ${schematicMeta.description}`;
        }
      )
    );
    bodyLines.push('');

    output.log({
      title: '',
      bodyLines,
    });
  } catch (error) {
    logger.fatal(error.message);
  }
}

function parseOptions(
  args: string[],
  outDir: string,
  collectionFile: string
): { [k: string]: any } {
  const schemaPath = path.join(outDir, args[0], 'schema.json');
  let booleanProps = [];
  if (fileExists(schemaPath)) {
    const { properties } = readJsonFile(
      path.join(outDir, args[0], 'schema.json')
    );
    if (properties) {
      booleanProps = Object.keys(properties).filter(
        (key) => properties[key].type === 'boolean'
      );
    }
  }
  const parsed = yargsParser(args, {
    boolean: ['dryRun', 'listGenerators', 'interactive', ...booleanProps],
    alias: {
      dryRun: ['d'],
      listSchematics: ['l'],
    },
    default: {
      interactive: true,
    },
    configuration: parserConfiguration,
  });
  parsed['generator'] = `${collectionFile}:${parsed['_'][0]}`;
  parsed['_'] = parsed['_'].slice(1);
  return parsed;
}

function createTmpTsConfig(
  tsconfigPath: string,
  updateConfig: Partial<TsConfig>
) {
  const tmpTsConfigPath = path.join(
    path.dirname(tsconfigPath),
    'tsconfig.generated.json'
  );
  const originalTSConfig = readJsonFile<TsConfig>(tsconfigPath);
  const generatedTSConfig: TsConfig = {
    ...originalTSConfig,
    ...updateConfig,
  };
  process.on('exit', () => cleanupTmpTsConfigFile(tmpTsConfigPath));
  writeJsonFile(tmpTsConfigPath, generatedTSConfig);

  return tmpTsConfigPath;
}

function cleanupTmpTsConfigFile(tmpTsConfigPath: string) {
  if (tmpTsConfigPath) {
    removeSync(tmpTsConfigPath);
  }
}
