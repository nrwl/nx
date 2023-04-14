import {
  Tree,
  getProjects,
  joinPathFragments,
  ExecutorsJson,
  updateJson,
  formatFiles,
  readJson,
} from '@nx/devkit';
import { ExecutorConfig } from 'nx/src/config/misc-interfaces';
import { PackageJson } from 'nx/src/utils/package-json';

export default async function update(tree: Tree): Promise<void> {
  for (const [project, { root }] of getProjects(tree)) {
    const packageJsonPath = joinPathFragments(root, 'package.json');
    if (!tree.exists(packageJsonPath)) {
      continue;
    }
    const packageJson = readJson<PackageJson>(tree, packageJsonPath);
    if (!packageJson.executors && !packageJson.builders) {
      continue;
    }
    const paths = [packageJson.executors, packageJson.builders].filter(Boolean);
    for (const collectionPathSegment of paths) {
      const collectionPath = joinPathFragments(root, collectionPathSegment);
      if (!tree.exists(collectionPath)) {
        continue;
      }
      const collectionFile: ExecutorsJson = readJson(tree, collectionPath);

      const collections = [
        collectionFile.builders,
        collectionFile.executors,
      ].filter(Boolean);
      for (const collection of collections) {
        if (!collection) {
          continue;
        }
        for (const entry of Object.values(collection)) {
          const schemaPath = joinPathFragments(root, entry.schema);
          if (tree.exists(schemaPath)) {
            updateJson(tree, schemaPath, (json: ExecutorConfig['schema']) => {
              if (json.version) {
                return json;
              } else {
                const newProperties: Partial<ExecutorConfig['schema']> = {
                  version: 2,
                };
                if (!json.outputCapture) {
                  newProperties.outputCapture = 'direct-nodejs';
                }
                return { ...newProperties, ...json };
              }
            });
          }
        }
      }
    }
  }
  await formatFiles(tree);
}
