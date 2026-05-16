import { readJsonFile } from '@nx/devkit';
import { existsSync } from 'fs';
import { join } from 'path';
import { readTsConfig } from '../../../utils/typescript/ts-config';
import {
  getPackageJsonModuleFormat,
  getTsConfigModuleFormat,
  type ModuleFormat,
} from '../../../utils/module-format/module-format';

export type { ModuleFormat };

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
      const fmt = getPackageJsonModuleFormat(readJsonFile(packageJsonPath));
      if (fmt) return fmt;
    } catch {
      // Continue to next detection method
    }
  }

  if (options.tsConfig && existsSync(options.tsConfig)) {
    try {
      const fmt = getTsConfigModuleFormat(
        readTsConfig(options.tsConfig).options
      );
      if (fmt) return fmt;
    } catch {
      // Continue to default
    }
  }

  return 'cjs';
}
