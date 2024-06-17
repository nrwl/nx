import {
  getProjects,
  joinPathFragments,
  ProjectConfiguration,
  readNxJson,
  Tree,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { moveGenerator } from '../move/move';

export async function monorepoGenerator(tree: Tree, options: {}) {
  const projects = getProjects(tree);

  const nxJson = readNxJson(tree);
  updateNxJson(tree, nxJson);

  let rootProject: ProjectConfiguration;
  const projectsToMove: ProjectConfiguration[] = [];

  // Need to determine libs vs packages directory base on the type of root project.
  for (const [, project] of projects) {
    if (project.root === '.') {
      rootProject = project;
    } else {
      projectsToMove.push(project);
    }
  }
  projectsToMove.unshift(rootProject); // move the root project 1st

  // Currently, Nx only handles apps+libs or packages. You cannot mix and match them.
  // If the standalone project is an app (React, Angular, etc), then use apps+libs.
  // Otherwise, for TS standalone (lib), use packages.
  const isRootProjectApp = rootProject.projectType === 'application';
  const appsDir = isRootProjectApp ? 'apps' : 'packages';
  const libsDir = isRootProjectApp ? 'libs' : 'packages';

  if (rootProject) {
    // If project was created using `nx init` then it might not have project.json.
    // Need to create one to avoid name conflicts with root package.json.
    if (!tree.exists('project.json')) {
      writeJson(tree, 'project.json', { name: rootProject.name });
    }
    updateJson(tree, 'package.json', (json) => {
      // Avoid name conflicts once we move root project into its own folder.
      json.name = `@${rootProject.name}/source`;
      return json;
    });
  }

  for (const project of projectsToMove) {
    await moveGenerator(tree, {
      projectName: project.name,
      newProjectName: project.name,
      destination:
        project.projectType === 'application'
          ? joinPathFragments(
              appsDir,
              project.root === '.' ? project.name : project.root
            )
          : joinPathFragments(
              libsDir,
              project.root === '.' ? project.name : project.root
            ),
      updateImportPath: project.projectType === 'library',
      projectNameAndRootFormat: 'as-provided',
    });
  }
}

export default monorepoGenerator;
