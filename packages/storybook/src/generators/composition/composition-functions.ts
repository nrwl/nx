import {
  applyChangesToString,
  ChangeType,
  getProjects,
  logger,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
  writeJson,
} from '@nrwl/devkit';
import { findNodes } from '@nrwl/workspace/src/utilities/typescript/find-nodes';
import { getTsSourceFile } from '../migrate-stories-to-6-2/migrate-stories-to-6-2';
import ts = require('typescript');
import { StorybookCompositionSchema } from './schema';

export interface NormalizedStorybookCompositionSchema {
  mainProject: string;
  projects?: string[];
  all?: boolean;
  useExistingPorts?: boolean;
}

export function normalizeSchema(
  schema: StorybookCompositionSchema
): NormalizedStorybookCompositionSchema {
  const normalizedSchema: NormalizedStorybookCompositionSchema = {
    mainProject: schema?.mainProject,
    all: schema?.all,
    useExistingPorts: schema?.useExistingPorts,
  };

  if (schema?.projects?.length > 0) {
    schema.projects = schema.projects.replace(' ', '');
    normalizedSchema.projects =
      schema.projects.length > 0 ? schema.projects.split(',') : undefined;
  }

  return normalizedSchema;
}

export function getMainProjectConfigFolderPath(
  tree: Tree,
  mainProject: string
): string | undefined {
  const projectConfig = readProjectConfiguration(tree, mainProject);
  if (
    projectConfig.targets &&
    projectConfig.targets.storybook &&
    projectConfig.targets.storybook.options &&
    projectConfig.targets.storybook.options.config &&
    projectConfig.targets.storybook.options.config.configFolder
  ) {
    return projectConfig.targets.storybook.options.config.configFolder;
  }
}

export function getProjectStorybookPort(
  tree: Tree,
  projectName: string
): number | undefined {
  const projectConfig = readProjectConfiguration(tree, projectName);
  if (
    projectConfig.targets &&
    projectConfig.targets.storybook &&
    projectConfig.targets.storybook.options &&
    projectConfig.targets.storybook.options.port
  ) {
    return projectConfig.targets.storybook.options.port;
  }
}

export function changePortOnWorkspaceJson(
  tree: Tree,
  projectName: string,
  projectPort: number
): boolean {
  const projectConfig = readProjectConfiguration(tree, projectName);
  if (
    projectConfig.targets &&
    projectConfig.targets.storybook &&
    projectConfig.targets.storybook.options &&
    projectConfig.targets.storybook.options.port
  ) {
    projectConfig.targets.storybook.options.port = projectPort;
    updateProjectConfiguration(tree, projectName, projectConfig);
    return true;
  }
  return false;
}

export function constructRefsObject(
  projectsAndPorts: {
    projectName: string;
    projectPort: number;
  }[]
): {
  refs: {
    [key: string]: {
      title: string;
      url: string;
    };
  };
} {
  const refsObject = {
    refs: {},
  };
  projectsAndPorts.forEach((project) => {
    refsObject.refs[`${project.projectName}`] = {
      title: project.projectName,
      url: `http://localhost:${project.projectPort}`,
    };
  });
  return refsObject;
}

export function addRefToMainProjectStorybookMainJs(
  tree: Tree,
  mainProjectName: string,
  refsObject: {
    refs: {
      [key: string]: {
        title: string;
        url: string;
      };
    };
  }
) {
  let newContents: string;
  let moduleExportsIsEmptyOrNonExistent = false;
  const mainProjectConfigFolderPath = getMainProjectConfigFolderPath(
    tree,
    mainProjectName
  );
  const mainProjectMainJsPath = `${mainProjectConfigFolderPath}/main.js`;
  const rootMainJsExists = tree.exists(mainProjectMainJsPath);
  if (rootMainJsExists) {
    const file = getTsSourceFile(tree, mainProjectMainJsPath);
    const appFileContent = tree.read(mainProjectMainJsPath, 'utf-8');
    newContents = appFileContent;
    const moduleExportsFull = findNodes(file, [
      ts.SyntaxKind.ExpressionStatement,
    ]);

    if (moduleExportsFull && moduleExportsFull[0]) {
      const moduleExports = moduleExportsFull[0];
      const listOfStatements = findNodes(moduleExports, [
        ts.SyntaxKind.SyntaxList,
      ]);

      let indexOfFirstNode = -1;

      const hasRefsObject = listOfStatements[0]?.getChildren()?.find((node) => {
        if (node && node.getText().length > 0 && indexOfFirstNode < 0) {
          indexOfFirstNode = node.getStart();
        }
        return (
          node.kind === ts.SyntaxKind.PropertyAssignment &&
          node.getText().startsWith('refs')
        );
      });

      if (hasRefsObject) {
        const refsStartIndex = hasRefsObject.getStart();
        const refsEndIndex = hasRefsObject.getEnd();

        // Delete old one
        newContents = applyChangesToString(newContents, [
          {
            type: ChangeType.Delete,
            start: refsStartIndex,
            length: refsEndIndex - refsStartIndex + 1,
          },
        ]);

        // Add new one
        newContents = applyChangesToString(newContents, [
          {
            type: ChangeType.Insert,
            index: indexOfFirstNode,
            text: `refs: ${JSON.stringify(refsObject.refs)},`,
          },
        ]);
      } else if (indexOfFirstNode >= 0) {
        /**
         * Does not have refs object,
         * so just write one, at the start.
         */
        newContents = applyChangesToString(newContents, [
          {
            type: ChangeType.Insert,
            index: indexOfFirstNode,
            text: `refs: ${JSON.stringify(refsObject.refs)},`,
          },
        ]);
      } else {
        /**
         * Module exports is empty, so write all a-new
         */
        moduleExportsIsEmptyOrNonExistent = true;
      }
    } else {
      /**
       * module.exports does not exist, so write all a-new
       */
      moduleExportsIsEmptyOrNonExistent = true;
    }
  } else {
    moduleExportsIsEmptyOrNonExistent = true;
  }

  if (moduleExportsIsEmptyOrNonExistent) {
    logger.error(`Project ${mainProjectName} does not have a valid Storybook configuration.
        Please first configure Storybook for ${mainProjectName} and then add Storybook composition.
        Alternatively, you can choose a different main project.`);
    return;
  } else {
    tree.write(mainProjectMainJsPath, newContents);
  }
}

export function fixCypressBaseURL(
  projectName: string,
  tree: Tree,
  port: number
) {
  const projectConfig = readProjectConfiguration(tree, projectName);
  if (projectConfig?.targets?.e2e?.options?.cypressConfig) {
    const cypressConfig = readJson(
      tree,
      projectConfig.targets.e2e.options.cypressConfig
    );
    cypressConfig.baseUrl = `http://localhost:${port}`;
    writeJson(
      tree,
      projectConfig.targets.e2e.options.cypressConfig,
      cypressConfig
    );
  }
}

export function findAllProjectsWithStorybookConfiguration(tree: Tree): {
  projectName: string;
  projectPort: number;
}[] {
  const projects = getProjects(tree);
  const projectsThatHaveStorybookConfiguration: {
    projectName: string;
    projectPort: number;
  }[] = [...projects.entries()]
    ?.filter(
      ([_, projectConfig]) =>
        projectConfig.targets &&
        projectConfig.targets.storybook &&
        projectConfig.targets.storybook.options
    )
    ?.map(([projectName, projectConfig]) => {
      return {
        projectName,
        projectPort: projectConfig.targets.storybook.options.port,
      };
    });
  return projectsThatHaveStorybookConfiguration;
}

export function addStorybookCompositionTask(
  tree: Tree,
  projectName: string,
  projects: string
) {
  const projectConfig = readProjectConfiguration(tree, projectName);
  projectConfig.targets['storybook-composition'] = {
    executor: '@nrwl/storybook:composition',
    options: {
      projects,
    },
  };
  updateProjectConfiguration(tree, projectName, projectConfig);
}

export function thereAreProjectsWithConflictingPorts(
  projectsAndPorts: {
    projectName: string;
    projectPort: number;
  }[]
) {
  const ports = projectsAndPorts.map(({ projectPort }) => projectPort);
  const uniquePorts = [...new Set(ports)];
  return uniquePorts.length !== ports.length;
}
