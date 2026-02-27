import { existsSync } from 'fs';
import { ParsedCommandLine } from 'typescript';
import { dirname, join } from 'path';
import { workspaceRoot } from '@nx/devkit';

let tsConfig: Map<string, ParsedCommandLine> = new Map();
let tsPathMappings: Map<string, ParsedCommandLine['options']['paths']> =
  new Map();

export function readTsPathMappings(
  tsConfigPath: string = process.env.NX_TSCONFIG_PATH ?? getRootTsConfigPath()
): ParsedCommandLine['options']['paths'] {
  if (tsPathMappings.has(tsConfigPath)) {
    return tsPathMappings.get(tsConfigPath);
  }

  if (!tsConfig.has(tsConfigPath)) {
    tsConfig.set(tsConfigPath, readTsConfiguration(tsConfigPath));
  }
  // Build the processed paths object in a single pass instead of
  // spreading on each iteration, which was O(n²) for n path aliases
  const processedPaths: Record<string, string[]> = {};
  for (const [alias, aliasPaths] of Object.entries(
    tsConfig.get(tsConfigPath).options?.paths ?? {}
  )) {
    processedPaths[alias] = aliasPaths.map((path) => path.replace(/^\.\//, ''));
  }
  tsPathMappings.set(tsConfigPath, processedPaths);

  return processedPaths;
}

function readTsConfiguration(tsConfigPath: string): ParsedCommandLine {
  if (!existsSync(tsConfigPath)) {
    throw new Error(
      `NX MF: TsConfig Path for workspace libraries does not exist! (${tsConfigPath}).`
    );
  }

  return readTsConfig(tsConfigPath);
}

let tsModule: typeof import('typescript');

export function readTsConfig(tsConfigPath: string): ParsedCommandLine {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  const readResult = tsModule.readConfigFile(
    tsConfigPath,
    tsModule.sys.readFile
  );
  return tsModule.parseJsonConfigFileContent(
    readResult.config,
    tsModule.sys,
    dirname(tsConfigPath)
  );
}

export function getRootTsConfigPath(): string | null {
  const tsConfigFileName = getRootTsConfigFileName();

  return tsConfigFileName ? join(workspaceRoot, tsConfigFileName) : null;
}

function getRootTsConfigFileName(): string | null {
  for (const tsConfigName of ['tsconfig.base.json', 'tsconfig.json']) {
    const tsConfigPath = join(workspaceRoot, tsConfigName);
    if (existsSync(tsConfigPath)) {
      return tsConfigName;
    }
  }

  return null;
}
