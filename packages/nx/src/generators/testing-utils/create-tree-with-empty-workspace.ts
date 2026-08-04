import { FsTree } from '../tree';
import type { Tree } from '../tree';
import { workspaceRoot } from '../../utils/workspace-root';

/**
 * Creates a host for testing.
 *
 * Defaults to oxfmt, matching what `create-nx-workspace` gives a new
 * workspace, so generator tests assert what users actually get. oxfmt formats
 * JS, TS, JSON, YAML and Markdown - nothing filters by extension on the way in
 * - so any spec asserting on generated file *content* is affected. Pass `none`
 * to assert exactly what the generator wrote, or `prettier` only for a test
 * that is about prettier itself.
 */
export function createTreeWithEmptyWorkspace(
  opts = {} as {
    layout?: 'apps-libs';
    formatter?: 'prettier' | 'oxfmt' | 'none';
  }
): Tree {
  const tree = new FsTree('/virtual', false);
  // Our unit tests are all written as though they are at the root of a workspace
  // However, when they are run in a subdirectory of the workspaceRoot,
  // the relative path between workspaceRoot and the directory the tests are run
  // is prepended to the paths created in the virtual tree.
  // Setting this envVar to workspaceRoot prevents this behaviour
  process.env.INIT_CWD = workspaceRoot;
  return addCommonFiles(tree, opts.layout === 'apps-libs', opts.formatter);
}

/**
 * @deprecated use createTreeWithEmptyWorkspace instead
 */
export function createTreeWithEmptyV1Workspace(): Tree {
  throw new Error(
    'Use createTreeWithEmptyWorkspace instead of createTreeWithEmptyV1Workspace'
  );
}

function addCommonFiles(
  tree: Tree,
  addAppsAndLibsFolders: boolean,
  formatter: 'prettier' | 'oxfmt' | 'none' = 'oxfmt'
): Tree {
  if (formatter === 'prettier') {
    tree.write('./.prettierrc', JSON.stringify({ singleQuote: true }));
  } else if (formatter === 'oxfmt') {
    tree.write('./.oxfmtrc.json', JSON.stringify({ singleQuote: true }));
  }
  tree.write(
    '/package.json',
    JSON.stringify({
      name: '@proj/source',
      dependencies: {},
      devDependencies: {},
    })
  );
  tree.write(
    '/nx.json',
    JSON.stringify({
      affected: {
        defaultBase: 'main',
      },
      targetDefaults: {
        build: {
          cache: true,
        },
        lint: {
          cache: true,
        },
      },
    })
  );
  tree.write(
    '/tsconfig.base.json',
    JSON.stringify({ compilerOptions: { paths: {} } })
  );
  if (addAppsAndLibsFolders) {
    tree.write('/apps/.gitignore', '');
    tree.write('/libs/.gitignore', '');
  }
  return tree;
}
