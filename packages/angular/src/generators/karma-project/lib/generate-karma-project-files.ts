import type { Tree } from '@nrwl/devkit';
import {
  generateFiles,
  getProjects,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';

export function generateKarmaProjectFiles(tree: Tree, project: string): void {
  const projectConfig = readProjectConfiguration(tree, project);
  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files', 'common'),
    projectConfig.root,
    {
      tmpl: '',
      projectRoot: projectConfig.root,
      offsetFromRoot: offsetFromRoot(projectConfig.root),
    }
  );

  if (projectConfig.root === '' || projectConfig.root === '.') {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '..', 'files', 'root-project'),
      projectConfig.root,
      {
        tmpl: '',
        projectName: project,
      }
    );
  } else if (isWorkspaceWithProjectAtRoot(tree)) {
    generateFiles(
      tree,
      joinPathFragments(
        __dirname,
        '..',
        'files',
        'workspace-with-root-project'
      ),
      projectConfig.root,
      {
        tmpl: '',
        projectRoot: projectConfig.root,
        offsetFromRoot: offsetFromRoot(projectConfig.root),
        rootProjectWithConfigSet: isUsingConfigSetInBaseKarmaConfig(tree),
      }
    );
  }
}

function isWorkspaceWithProjectAtRoot(tree: Tree): boolean {
  const projects = getProjects(tree);
  for (const [, project] of projects) {
    if (project.root === '.' || project.root === '') {
      return true;
    }
  }

  return false;
}

function isUsingConfigSetInBaseKarmaConfig(tree: Tree) {
  if (!tree.exists('karma.conf.js')) {
    return false;
  }

  const CONFIG_SET_SELECTOR =
    'PropertyAccessExpression:has(Identifier[name=config], Identifier[name=set])';

  const ast = tsquery.ast(tree.read('karma.conf.js', 'utf-8'));
  const nodes = tsquery(ast, CONFIG_SET_SELECTOR, { visitAllChildren: true });

  return nodes.length > 0;
}
