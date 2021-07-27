import * as glob from 'glob';
import * as path from 'path';
import { Framework, Frameworks } from './frameworks';

export interface Configuration {
  name: string;
  root: string;
  framework: Framework;
  source: string;
  output: string;
  builderOutput: string;
  schematicOutput: string;
  hasBuilders: boolean;
  hasSchematics: boolean;
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
): { framework: Framework; configs: Configuration[] }[] {
  return Frameworks.map((framework: Framework) => {
    const packagesDir = path.resolve(
      path.join(__dirname, '../../', packagesDirectory)
    );
    const documentationDir = path.resolve(
      path.join(__dirname, '../../', documentationsDirectory)
    );

    const configs = glob
      .sync(`${packagesDir}/*`)
      .map((folderPath): Configuration => {
        const folderName = folderPath.substring(packagesDir.length + 1);
        const itemList = glob
          .sync(`${folderPath}/*`)
          .map((item) => item.split(folderPath + '/')[1]);
        const output = path.join(
          documentationDir,
          framework,
          `api-${folderName}`
        );
        return {
          name: folderName,
          root: folderPath,
          source: path.join(folderPath, '/src'),
          output,
          framework,
          builderOutput: path.join(output, 'executors'),
          schematicOutput: path.join(output, 'generators'),
          hasBuilders: itemList.includes('executors.json'),
          hasSchematics: itemList.includes('generators.json'),
        };
      });
    return { framework, configs };
  });
}
