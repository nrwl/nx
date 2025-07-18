import { readJsonFile } from '@nx/devkit';
import { existsSync } from 'fs';
import { join } from 'path';
import { readTsConfig } from '../../../utils/typescript/ts-config';
import * as ts from 'typescript';

export type ModuleFormat = 'cjs' | 'esm';

export interface ModuleFormatDetectionOptions {
  projectRoot: string;
  workspaceRoot: string;
  tsConfig?: string;
  main: string;
  buildOptions?: any;
}

export function detectModuleFormat(
  options: ModuleFormatDetectionOptions
): ModuleFormat {
  if (options.buildOptions?.format) {
    const formats = Array.isArray(options.buildOptions.format)
      ? options.buildOptions.format
      : [options.buildOptions.format];

    if (formats.includes('esm')) {
      return 'esm';
    }

    if (formats.includes('cjs')) {
      return 'cjs';
    }
  }

  if (options.main.endsWith('.mjs')) {
    return 'esm';
  }
  if (options.main.endsWith('.cjs')) {
    return 'cjs';
  }

  const packageJsonPath = join(
    options.workspaceRoot,
    options.projectRoot,
    'package.json'
  );
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = readJsonFile(packageJsonPath);
      if (packageJson.type === 'module') {
        return 'esm';
      }
      if (packageJson.type === 'commonjs') {
        return 'cjs';
      }
    } catch {
      // Continue to next detection method
    }
  }

  if (options.tsConfig && existsSync(options.tsConfig)) {
    try {
      const tsConfig = readTsConfig(options.tsConfig);
      if (
        tsConfig.options.module === ts.ModuleKind.ES2015 ||
        tsConfig.options.module === ts.ModuleKind.ES2020 ||
        tsConfig.options.module === ts.ModuleKind.ES2022 ||
        tsConfig.options.module === ts.ModuleKind.ESNext ||
        tsConfig.options.module === ts.ModuleKind.NodeNext
      ) {
        // For NodeNext, we need to check moduleResolution
        if (tsConfig.options.module === ts.ModuleKind.NodeNext) {
          // NodeNext uses package.json type field, which we already checked
          // Default to CJS if no type field
          return 'cjs';
        }
        return 'esm';
      }
    } catch {
      // Continue to default
    }
  }

  return 'cjs';
}
