import {
  formatFiles,
  getProjects,
  joinPathFragments,
  logger,
  type Tree,
} from '@nx/devkit';
import {
  isTypescriptVersionAtLeast,
  isUsingTsSolutionSetup,
} from '@nx/js/internal';
import {
  applyEdits,
  findNodeAtLocation,
  getNodeValue,
  modify,
  parseTree,
} from 'jsonc-parser';
import { findJestConfig } from '../../utils/config/config-file';

const FORMATTING_OPTIONS = {
  formattingOptions: { keepLines: true, insertSpaces: true, tabSize: 2 },
};

// A jest config mentioning any of these uses swc/babel/angular (or is the root
// aggregator), not ts-jest, so skip it.
const NON_TS_JEST_MARKERS = [
  '@swc/jest',
  'babel-jest',
  'jest-preset-angular',
  'getJestProjectsAsync',
];

/**
 * NXC-4591: ts-jest 29.2+ uses `moduleResolution: node10` on the CommonJS path
 * for TypeScript < 6, which ignores package `exports` and breaks exports-only
 * workspace libs (TS2307). `isolatedModules: true` makes ts-jest transpile per
 * file, skipping that resolution. TS >= 6 is unaffected.
 */
export default async function (tree: Tree) {
  // TS >= 6 resolves `exports` under bundler + commonjs; not affected.
  if (isTypescriptVersionAtLeast(tree, '6.0.0')) {
    return;
  }
  // Path-based workspaces resolve via tsconfig `paths`, not `exports`; skip them.
  if (!isUsingTsSolutionSetup(tree)) {
    return;
  }
  // Fresh ts-solution workspaces already enable this in the base config.
  if (rootEnablesIsolatedModules(tree)) {
    return;
  }

  let count = 0;
  for (const [, project] of getProjects(tree)) {
    const specPath = getTsJestSpecTsconfig(tree, project.root);
    if (specPath && setIsolatedModules(tree, specPath)) {
      count++;
    }
  }

  if (count > 0) {
    logger.info(
      `NXC-4591: set "isolatedModules": true in ${count} tsconfig.spec.json file(s) so ts-jest resolves exports-only workspace libraries on TypeScript < 6.`
    );
  }

  await formatFiles(tree);
}

function rootEnablesIsolatedModules(tree: Tree): boolean {
  return (
    readCompilerOption(tree, 'tsconfig.base.json', 'isolatedModules') === true
  );
}

// The project's tsconfig.spec.json if it runs ts-jest, else null.
function getTsJestSpecTsconfig(tree: Tree, root: string): string | null {
  const jestConfig = findJestConfig(tree, root);
  if (!jestConfig) {
    return null;
  }
  const source = tree.read(jestConfig, 'utf-8') ?? '';
  if (NON_TS_JEST_MARKERS.some((marker) => source.includes(marker))) {
    return null;
  }
  const specPath = joinPathFragments(root, 'tsconfig.spec.json');
  return tree.exists(specPath) ? specPath : null;
}

function setIsolatedModules(tree: Tree, tsconfigPath: string): boolean {
  if (readCompilerOption(tree, tsconfigPath, 'isolatedModules') === true) {
    return false;
  }
  const contents = tree.read(tsconfigPath, 'utf-8');
  if (!contents) {
    return false;
  }
  const edits = modify(
    contents,
    ['compilerOptions', 'isolatedModules'],
    true,
    FORMATTING_OPTIONS
  );
  tree.write(tsconfigPath, applyEdits(contents, edits));
  return true;
}

function readCompilerOption(
  tree: Tree,
  tsconfigPath: string,
  option: string
): unknown {
  const contents = tree.read(tsconfigPath, 'utf-8');
  if (!contents) {
    return undefined;
  }
  const root = parseTree(contents);
  const node = root && findNodeAtLocation(root, ['compilerOptions', option]);
  return node ? getNodeValue(node) : undefined;
}
