import {
  joinPathFragments,
  normalizePath,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { relative } from 'node:path';
import type { NormalizedGeneratorOptions } from '../schema';

export function addPackageExport(
  tree: Tree,
  options: NormalizedGeneratorOptions
): void {
  const packageJsonPath = joinPathFragments(
    options.libraryProject.root,
    'package.json'
  );
  const entryPointPath = normalizePath(
    relative(options.libraryProject.root, options.entryPointDestination)
  );
  const exportKey = `./${entryPointPath}`;

  updateJson(tree, packageJsonPath, (json) => {
    const exports = toSubpathExports(json.exports);
    if (Object.hasOwn(exports, exportKey)) {
      throw new Error(
        `The entry point "${exportKey}" already exists in "${packageJsonPath}".`
      );
    }

    json.exports = {
      ...exports,
      [exportKey]: `./${entryPointPath}/src/index.ts`,
    };
    return json;
  });
}

// A string, an array or a conditions object is the primary entry point.
function toSubpathExports(exports: unknown): Record<string, unknown> {
  if (typeof exports === 'string' || Array.isArray(exports)) {
    return { '.': exports };
  }
  if (!exports || typeof exports !== 'object') {
    return {};
  }

  const keys = Object.keys(exports);
  if (keys.some((key) => key.startsWith('.'))) {
    return { ...exports };
  }
  return keys.length > 0 ? { '.': exports } : {};
}
