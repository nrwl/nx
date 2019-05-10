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
): Configuration[] {
  const packagesDir = path.resolve(
    path.join(__dirname, '../../', packagesDirectory)
  );
  const documentationDir = path.resolve(
    path.join(__dirname, '../../', documentationsDirectory)
  );
  return shelljs.ls(packagesDir).map(folderName => {
    const itemList = shelljs.ls(path.join(packagesDir, folderName));
    const output = path.join(documentationDir, `api-${folderName}`);
    return {
      name: folderName,
      root: path.join(packagesDir, folderName),
      source: path.join(packagesDir, `${folderName}/src`),
      output,
      builderOutput: path.join(output, 'builders'),
      schematicOutput: path.join(output, 'schematics'),
      hasBuilders: itemList.includes('builders.json'),
      hasSchematics: itemList.includes('collection.json')
    };
  });
}
