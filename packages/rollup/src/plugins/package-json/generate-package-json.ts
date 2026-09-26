import type { Plugin } from 'rollup';
import { updatePackageJson } from './update-package-json';
import { type PackageJson } from '@nx/devkit/internal';

export interface GeneratePackageJsonOptions {
  outputPath: string;
  main: string;
  format: string[];
  generateExportsField?: boolean;
  skipTypeField?: boolean;
  outputFileName?: string;
  additionalEntryPoints?: string[];
}

export const pluginName = 'rollup-plugin-nx-generate-package-json';

export function generatePackageJson(
  options: GeneratePackageJsonOptions,
  packageJson: PackageJson
): Plugin {
  return {
    name: pluginName,
    writeBundle: () => {
      updatePackageJson(options, packageJson);
    },
  };
}
