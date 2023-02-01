import * as chalk from 'chalk';
import { execSync } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import { copySync, removeSync } from 'fs-extra';
import * as path from 'path';
import * as yargsParser from 'yargs-parser';
import { workspaceRoot } from '../utils/workspace-root';
import { fileExists } from '../utils/fileutils';
import { output } from '../utils/output';
import type { CompilerOptions } from 'typescript';
import { generate } from './generate';
import { readJsonFile, writeJsonFile } from '../utils/fileutils';
import { logger } from '../utils/logger';
import { getPackageManagerCommand } from '../utils/package-manager';
import { normalizePath } from '../utils/path';
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

export async function workspaceGenerators(args: string[]) {
  const outDir = compileTools();
  const collectionFile = path.join(outDir, 'workspace-generators.json');
  const parsedArgs = parseOptions(args, outDir, collectionFile);
  if (parsedArgs.listGenerators) {
    return listGenerators(collectionFile);
  } else {
    process.exitCode = await generate(process.cwd(), parsedArgs);
  }
}

export function workspaceGeneratorSchema(name: string) {
  const schemaFile = path.join(generatorsDir, name, 'schema.json');

  if (fileExists(schemaFile)) {
    return readJsonFile(schemaFile);
  } else {
    logger.error(`Cannot find schema for ${name}. Does the generator exist?`);
    process.exit(1);
  }
}

// compile tools
function compileTools() {
  const toolsOutDir = getToolsOutDir();
  removeSync(toolsOutDir);
  compileToolsDir(toolsOutDir);

  const generatorsOutDir = path.join(toolsOutDir, 'generators');
  const collectionData = constructCollection();
  writeJsonFile(
    path.join(generatorsOutDir, 'workspace-generators.json'),
    collectionData
  );
  return generatorsOutDir;
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
  const schematics = {};
  readdirSync(generatorsDir).forEach((c) => {
    const childDir = path.join(generatorsDir, c);
    if (existsSync(path.join(childDir, 'schema.json'))) {
      const generatorOrSchematic = {
        factory: `./${c}`,
        schema: `./${normalizePath(path.join(c, 'schema.json'))}`,
        description: `Schematic ${c}`,
      };

      const { isSchematic } = readJsonFile(path.join(childDir, 'schema.json'));
      if (isSchematic) {
        schematics[c] = generatorOrSchematic;
      } else {
        generators[c] = generatorOrSchematic;
      }
    }
  });
  return {
    name: 'workspace-generators',
    version: '1.0',
    generators,
    schematics,
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
