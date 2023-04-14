import {
  GeneratorsJson,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { PackageJson } from 'nx/src/utils/package-json';

export function hasGenerator(
  tree: Tree,
  projectName: string,
  generatorName: string
): boolean {
  const project = readProjectConfiguration(tree, projectName);
  const packageJson = readJson<PackageJson>(
    tree,
    joinPathFragments(project.root, 'package.json')
  );
  if (!packageJson.generators && !packageJson.schematics) {
    return false;
  }
  const generatorsPath = joinPathFragments(
    project.root,
    packageJson.generators ?? packageJson.schematics
  );
  const generatorsJson = readJson<GeneratorsJson>(tree, generatorsPath);
  return (
    (generatorsJson.generators?.[generatorName] ??
      generatorsJson.schematics?.[generatorName]) !== undefined
  );
}
