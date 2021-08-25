import {
  Tree,
  updateJson,
  visitNotIgnoredFiles,
  normalizePath,
  formatFiles,
} from '@nrwl/devkit';
import { basename, relative } from 'path';

export default async function moveExtendsIntoOverrides(tree: Tree) {
  if (!tree.exists('.eslintrc.json')) {
    return;
  }

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (basename(filePath) !== '.eslintrc.json') {
      return;
    }

    updateJson<{
      extends?: string | string[];
      overrides?: Array<{ extends: string | string[] }>;
    }>(tree, filePath, (json) => {
      if (
        !json.extends ||
        !json.overrides ||
        json.overrides.every((override) => !override.extends)
      ) {
        return json;
      }

      const baseExtends = normalizeExtends(json.extends);
      for (const override of json.overrides) {
        override.extends = [
          ...normalizeExtends(override.extends),
          ...baseExtends,
        ];
      }

      delete json.extends;

      return json;
    });
  });

  await formatFiles(tree);
}

function normalizeExtends(extensions: string | string[]) {
  if (!extensions) {
    return [];
  }

  if (!Array.isArray(extensions)) {
    return [extensions];
  }

  return extensions;
}
