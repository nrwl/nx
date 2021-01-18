import * as path from 'path';
import * as shelljs from 'shelljs';

export interface Configuration {
  name: string;
  root: string;
  source: string;
  output: string;
  builderOutput: string;
  schematicOutput: string;
  hasBuilders: string;
  hasSchematics: string;
}

/**
 * Generate the configuration by exploring the directory path given.
 * @param packagesDirectory
 * @param documentationsDirectory
 * @returns Configuration
 */
export function getPackageConfigurations(
  packagesDirectory: string = 'packages',
  documentationsDirectory: string = 'docs'
): { framework: 'angular' | 'react' | 'node'; configs: Configuration[] }[] {
  return ['angular', 'react', 'node'].map((framework) => {
    const packagesDir = path.resolve(
      path.join(__dirname, '../../', packagesDirectory)
    );
    const documentationDir = path.resolve(
      path.join(__dirname, '../../', documentationsDirectory)
    );
    const configs = shelljs.ls(packagesDir).map((folderName) => {
      const itemList = shelljs.ls(path.join(packagesDir, folderName));
      const output = path.join(
        documentationDir,
        framework,
        `api-${folderName}`
      );
      return {
        name: folderName,
        root: path.join(packagesDir, folderName),
        source: path.join(packagesDir, `${folderName}/src`),
        output,
        framework,
        builderOutput: path.join(output, 'executors'),
        schematicOutput: path.join(output, 'generators'),
        hasBuilders:
          itemList.includes('builders.json') ||
          itemList.includes('executors.json'),
        hasSchematics:
          itemList.includes('collection.json') ||
          itemList.includes('generators.json'),
      };
    });
    return { framework: framework as any, configs };
  });
}
