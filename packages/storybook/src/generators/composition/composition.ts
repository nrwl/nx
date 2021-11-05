import {
  convertNxGenerator,
  formatFiles,
  logger,
  stripIndents,
  Tree,
} from '@nrwl/devkit';
import {
  addRefToMainProjectStorybookMainJs,
  addStorybookCompositionTask,
  thereAreProjectsWithConflictingPorts,
  changePortOnWorkspaceJson,
  constructRefsObject,
  findAllProjectsWithStorybookConfiguration,
  fixCypressBaseURL,
  getMainProjectConfigFolderPath,
  getProjectStorybookPort,
  normalizeSchema,
} from './composition-functions';
import { StorybookCompositionSchema } from './schema';

export async function compositionGenerator(
  tree: Tree,
  schema: StorybookCompositionSchema
) {
  const normalizedSchema = normalizeSchema(schema);

  const mainProjectConfigFolderPath = getMainProjectConfigFolderPath(
    tree,
    normalizedSchema.mainProject
  );
  if (!mainProjectConfigFolderPath || !mainProjectConfigFolderPath.length) {
    logger.error(`Project ${normalizedSchema.mainProject} does not exist, or does not have a valid Storybook configuration.
      Please try again, and provide a valid project name.`);
    return;
  }

  const projectsAndPorts: {
    projectName: string;
    projectPort: number;
  }[] = [];
  let commaSeparatedProjects = '';
  let projects: { projectName: string; projectPort: number }[] = [];

  if (normalizedSchema.projects && normalizedSchema.all !== true) {
    projects = normalizedSchema.projects.map((projectName: string) => {
      return {
        projectName,
        projectPort: getProjectStorybookPort(tree, projectName),
      };
    });
  } else {
    projects = findAllProjectsWithStorybookConfiguration(tree);
  }

  projects = projects.filter(
    (project) => project.projectName !== normalizedSchema.mainProject
  );

  projects.forEach((project, index) => {
    let portForMainJs = project.projectPort;
    if (!normalizedSchema.useExistingPorts) {
      if (changePortOnWorkspaceJson(tree, project.projectName, 4401 + index)) {
        logger.info(
          `Updated port for project ${project.projectName} to ${4401 + index}`
        );
        portForMainJs = 4401 + index;
        fixCypressBaseURL(`${project.projectName}-e2e`, tree, 4401 + index);
      } else {
        logger.info(
          `Could not find Storybook configuration for project ${project.projectName} in workspace.json`
        );
      }
    }

    projectsAndPorts.push({
      projectName: project.projectName,
      projectPort: portForMainJs,
    });
    commaSeparatedProjects =
      commaSeparatedProjects.length > 0
        ? commaSeparatedProjects + ',' + project.projectName
        : project.projectName;
  });

  addRefToMainProjectStorybookMainJs(
    tree,
    normalizedSchema.mainProject,
    constructRefsObject(projectsAndPorts)
  );

  addStorybookCompositionTask(
    tree,
    normalizedSchema.mainProject,
    commaSeparatedProjects
  );

  await formatFiles(tree);

  if (thereAreProjectsWithConflictingPorts(projectsAndPorts)) {
    logger.warn(stripIndents`
    Two or more projects have conflicting ports. Before running the storybook-composition task,
    please make sure you update your project ports in workspace.json and in ${mainProjectConfigFolderPath}/main.js
    so that they are unique. Avoid using port 4400 as it is reserved for the main project.
    `);
  }

  logger.info(stripIndents`
    Successfully generated Storybook composition for your projects.

    You can now run the following command to start Storybook composition on http://localhost:4400:

    // TODO: Add new command here
  `);
}

export default compositionGenerator;
export const compositionSchematic = convertNxGenerator(compositionGenerator);
