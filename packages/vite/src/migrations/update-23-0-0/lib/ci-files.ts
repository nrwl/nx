import { visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import picomatch = require('picomatch');

// Common CI provider configs. Mechanical edits inside YAML are risky
// (comments, anchors, multi-line strings), so the pre-pass only scans these
// for legacy tokens and forwards file paths as advisory context.
const CI_GLOBS = [
  '**/.github/workflows/*.{yml,yaml}',
  '**/.gitlab-ci.yml',
  '**/.gitlab-ci.*.yml',
  '**/azure-pipelines.{yml,yaml}',
  '**/azure-pipelines.*.{yml,yaml}',
  '**/.circleci/config.yml',
  '**/bitbucket-pipelines.yml',
];

const ciMatchers = CI_GLOBS.map((g) => picomatch(g));

export function isCiFile(filePath: string): boolean {
  return ciMatchers.some((m) => m(filePath));
}

export function visitCiFiles(
  tree: Tree,
  callback: (filePath: string, contents: string) => void
): void {
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!isCiFile(filePath)) return;
    const contents = tree.read(filePath, 'utf-8');
    callback(filePath, contents);
  });
}
