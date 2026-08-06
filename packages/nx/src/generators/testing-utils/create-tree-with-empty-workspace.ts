import { FsTree } from '../tree';
import type { Tree } from '../tree';
import type { FormatterType } from '../../utils/formatters';
import { workspaceRoot } from '../../utils/workspace-root';

/**
 * A formatter choice rather than a dispatch target, so `'none'` is composed in
 * here instead of living in `FormatterType`.
 */
type TestFormatter = FormatterType | 'none';

/**
 * Keyed by `FormatterType` so adding a formatter fails to compile here until
 * this helper can seed it, rather than silently producing a workspace with no
 * config. One of the sites `FormatterType` inventories.
 */
const formatterConfigFiles = {
  prettier: '.prettierrc',
  oxfmt: '.oxfmtrc.json',
} satisfies Record<FormatterType, string>;

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
    formatter?: TestFormatter;
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
  formatter: TestFormatter = 'oxfmt'
): Tree {
  if (formatter !== 'none') {
    tree.write(
      `./${formatterConfigFiles[formatter]}`,
      JSON.stringify({ singleQuote: true })
    );
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
