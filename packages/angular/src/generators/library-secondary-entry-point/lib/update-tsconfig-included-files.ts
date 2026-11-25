import { joinPathFragments, updateJson, type Tree } from '@nx/devkit';
import type { NormalizedGeneratorOptions } from '../schema';

export function updateTsConfigIncludedFiles(
  tree: Tree,
  options: NormalizedGeneratorOptions
): void {
  const candidateTsConfigPaths = [
    options.libraryProject.targets?.build?.options?.tsConfig,
    joinPathFragments(options.libraryProject.root, 'tsconfig.lib.json'),
    joinPathFragments(options.libraryProject.root, 'tsconfig.json'),
  ];

  const tsConfigPath = candidateTsConfigPaths.find(
    (path) => path && tree.exists(path)
  );
  if (!tsConfigPath) {
    // ignore if the library has a custom tsconfig setup
    return;
  }

  const entryPointPrefix = `${options.name}/`;
  const libraryRoot = options.libraryProject.root;

  updateJson(tree, tsConfigPath, (json) => {
    json.include = appendEntryPointGlobs(
      tree,
      libraryRoot,
      json.include,
      entryPointPrefix
    );
    json.exclude = appendEntryPointGlobs(
      tree,
      libraryRoot,
      json.exclude,
      entryPointPrefix
    );

    return json;
  });
}

function appendEntryPointGlobs(
  tree: Tree,
  libraryRoot: string,
  patterns: string[] | undefined,
  entryPointPrefix: string
): string[] | undefined {
  if (!patterns?.length) {
    return patterns;
  }

  const seen = new Set(patterns);
  const prefixedPatterns: string[] = [];

  for (const pattern of patterns) {
    if (
      !pattern.includes('*') ||
      isSecondaryEntryPointGlob(tree, libraryRoot, pattern)
    ) {
      continue;
    }

    const prefixedPattern = `${entryPointPrefix}${pattern}`;
    if (seen.has(prefixedPattern)) {
      continue;
    }

    seen.add(prefixedPattern);
    prefixedPatterns.push(prefixedPattern);
  }

  return [...patterns, ...prefixedPatterns];
}

// Globs already rooted at a secondary entry point were derived from the
// primary patterns. Prefixing them again yields `secondary2/secondary1/src`.
function isSecondaryEntryPointGlob(
  tree: Tree,
  libraryRoot: string,
  pattern: string
): boolean {
  let currentPath = libraryRoot;

  for (const segment of pattern.split(/[/\\]/)) {
    if (
      segment.includes('*') ||
      segment.includes('?') ||
      segment.includes('[')
    ) {
      return false;
    }

    // `.` is the library root, whose ng-package.json is the primary entry.
    // `..` leaves the library.
    if (segment === '..') {
      return false;
    }
    if (segment === '' || segment === '.') {
      continue;
    }

    currentPath = joinPathFragments(currentPath, segment);
    if (!tree.exists(currentPath) || tree.isFile(currentPath)) {
      return false;
    }

    if (tree.exists(joinPathFragments(currentPath, 'ng-package.json'))) {
      return true;
    }
  }

  return false;
}
