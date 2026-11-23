import {
  GeneratorsJson,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { PackageJson } from '@nx/devkit/internal';

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
  const generatorsFile = packageJson.generators ?? packageJson.schematics;
  if (!generatorsFile) {
    return false;
  }
  const generatorsPath = joinPathFragments(project.root, generatorsFile);
  const generatorsJson = readJson<GeneratorsJson>(tree, generatorsPath);
  return (
    (generatorsJson.generators?.[generatorName] ??
      generatorsJson.schematics?.[generatorName]) !== undefined
  );
}
