import * as path from 'path';
import type { CompilerOptions } from 'typescript';
import { readJsonFile } from './fileutils';
import { logger } from './logger';
import { workspaceRoot } from './workspace-root';

export type TsConfig = {
  extends: string;
  compilerOptions: CompilerOptions;
  files?: string[];
  include?: string[];
  exclude?: string[];
  references?: Array<{ path: string }>;
};

const rootDirectory = workspaceRoot;
const toolsDir = path.join(rootDirectory, 'tools');
export const toolsTsConfigPath = path.join(toolsDir, 'tsconfig.tools.json');

function toolsTsConfig(): TsConfig {
  return readJsonFile<TsConfig>(toolsTsConfigPath);
}

export function getToolsOutDir() {
  const outDir = toolsTsConfig().compilerOptions.outDir;

  if (!outDir) {
    logger.error(`${toolsTsConfigPath} must specify an outDir`);
    process.exit(1);
  }

  return path.resolve(toolsDir, outDir);
}
