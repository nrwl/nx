import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from 'nx/src/generators/tree';
import { formatFiles } from './format-files';
import { visitNotIgnoredFiles } from './visit-not-ignored-files';

// devkit's `nx` peer spans a major either side, so it runs against an nx that
// predates the ignore checkers. Those reach devkit as `undefined` rather than as
// a load failure, so without a guard the first call is `undefined is not a
// function` thrown from inside whatever generator happened to run.
//
// The names stripped are the whole contract of this file. The factory repeats
// them as a literal because jest hoists it above this declaration, so
// `guards the simulation itself` compares the mock's *effect* against this list
// rather than trusting either copy - drift in either direction fails. That is
// the hole the sibling formatter skew spec had, which let it certify a version
// of nx that never existed.
//
// A checker added later belongs in both lists, and in
// `assertNxSupportsIgnoreCheckers` too if it becomes the symbol that probes for.
const ABSENT_ON_OLDER_NX = [
  'createGitIgnoreChecker',
  'createPrettierIgnoreChecker',
] as const;

jest.mock('nx/src/devkit-internals', () => {
  const actual = jest.requireActual('nx/src/devkit-internals');
  const olderNx = { ...actual };
  for (const name of [
    'createGitIgnoreChecker',
    'createPrettierIgnoreChecker',
  ]) {
    delete olderNx[name];
  }
  return olderNx;
});

describe('ignore checkers against an nx without them', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('guards the simulation itself', () => {
    const actual = jest.requireActual('nx/src/devkit-internals');
    const mocked = require('nx/src/devkit-internals');

    const stripped = Object.keys(actual)
      .filter((name) => !(name in mocked))
      .sort();
    expect(stripped).toEqual([...ABSENT_ON_OLDER_NX].sort());
    // Something must survive, or the mock is testing an empty module.
    expect(mocked.isUsingPrettierInTree).toBeDefined();
  });

  // The two callers degrade in opposite directions on purpose.

  it('should fail the walk by name rather than with a TypeError', () => {
    // Without a checker nothing is ignored, so the walk would descend into
    // node_modules and hand a migration every file in it. Failing beats that.
    tree.write('src/a.ts', '');

    expect(() => visitNotIgnoredFiles(tree, '', () => {})).toThrow(
      /does not export the ignore checkers.*nx migrate latest/s
    );
  });

  it('should still format, filtering nothing, rather than failing', async () => {
    // Filtering nothing is what this nx pairing always did, so a generator that
    // formats is the right answer here - not one that refuses to run.
    tree.write('.prettierrc', '{}');
    tree.write('.gitignore', 'ignored.ts\n');
    tree.write('ignored.ts', 'const   x   =   1');

    await expect(formatFiles(tree)).resolves.toBeUndefined();
  });
});
