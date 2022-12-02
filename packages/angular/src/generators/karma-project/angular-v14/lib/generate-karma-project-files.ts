import type { Tree } from '@nrwl/devkit';
import {
  generateFiles,
  getProjects,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
} from '@nrwl/devkit';

export function generateKarmaProjectFiles(tree: Tree, project: string): void {
  const projectConfig = readProjectConfiguration(tree, project);
  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files', 'common'),
    projectConfig.root,
    {
      tmpl: '',
      isLibrary: projectConfig.projectType === 'library',
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
