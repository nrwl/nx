import type { Plugin } from 'rollup';
import type { PackageJson } from 'nx/src/utils/package-json';
import { updatePackageJson } from './update-package-json';

export interface GeneratePackageJsonOptions {
  outputPath: string;
  main: string;
  format: string[];
  generateExportsField?: boolean;
  skipTypeField?: boolean;
  outputFileName?: string;
  additionalEntryPoints?: string[];
}

export function generatePackageJson(
  options: GeneratePackageJsonOptions,
  packageJson: PackageJson
): Plugin {
  return {
    name: 'rollup-plugin-nx-generate-package-json',
    writeBundle: () => {
      updatePackageJson(options, packageJson);
    },
  };
}
