/**
 * This file is used to generate the inputs for the graph command
 */
import { minimatch } from 'minimatch';

import { ProjectGraphProjectNode } from '../../config/project-graph';
import { FileData } from '../../config/project-graph';
import { InputDefinition } from '../../config/workspace-json-project-json';
import { getRootTsConfigPath } from '../../plugins/js/utils/typescript';
import {
  expandNamedInput,
  extractPatternsFromFileSets,
  filterUsingGlobPatterns,
} from '../../hasher/task-hasher';
import type { ProjectGraphClientResponse } from './graph';

export interface ExpandedInputs {
  general?: { [plan: string]: string[] };
  [projectName: string]: { [plan: string]: string[] };
  external?: { [plan: string]: string[] };
}

/**
 * This function is used to expand the inputs for the graph command.
 * It categorizes the inputs and expand them into file paths.
 * @param plans e.g. ['{workspaceRoot}/**', 'app:src/**']
 * @param allWorkspaceFiles
 * @param depGraphClientResponse
 * @returns a record of expanded inputs. e.g. {general: [{file: 'apps/app/src/main.ts', plan: '{workspaceRoot}/apps/app/src/main.ts'}], app: [{file: 'src/main.ts', plan: 'app:src/main.ts'}], external: [{file: 'node_modules/some-lib/index.ts', plan: 'node_modules/some-lib/index.ts'}]
 */
export function expandInputs(
  plans: string[],
  allWorkspaceFiles: FileData[],
  depGraphClientResponse: ProjectGraphClientResponse,
  taskId: string
): ExpandedInputs {
  const projectNames = depGraphClientResponse.projects?.map((p) => p.name);

  const {
    workspaceRootInputs,
    projectRootInputs,
    externalInputs,
    otherInputs,
  } = categorizeInputs(plans, projectNames, taskId);

  const general = {
    ...getExpandWorkspaceRootInputs(workspaceRootInputs, allWorkspaceFiles),
    ...getExpandOtherInputs(otherInputs),
  };
  const project = getExpandProjectInputs(
    projectRootInputs,
    depGraphClientResponse
  );
  const external = externalInputs.reduce((acc, plan) => {
    acc[plan] = [plan];
    return acc;
  }, {});

  return {
    general: Object.values(general).length ? general : undefined,
    external: Object.values(external).length ? external : undefined,
    ...project,
  };
}

/**
 * This function is used to categorize the inputs into different categories
 */
export function categorizeInputs(
  inputs: string[],
  projectNames: string[],
  taskId: string
): {
  workspaceRootInputs: string[];
  projectRootInputs: {
    projectName: string;
    plan: string;
  }[];
  externalInputs: string[];
  otherInputs: string[];
} {
  const projectName = taskId.split(':')[0];
  const workspaceRootInputs: string[] = [];
  const projectRootInputs: {
    projectName: string;
    plan: string;
  }[] = [];
  const externalInputs: string[] = [];
  const otherInputs: string[] = [];
  inputs.forEach((input) => {
    if (input.startsWith('{workspaceRoot}')) {
      workspaceRootInputs.push(input);
      return;
    }
    if (input.startsWith('{projectRoot}')) {
      projectRootInputs.push({
        projectName,
        plan: input,
      });
      return;
    }
    if (
      input === 'ProjectConfiguration' ||
      input === 'TsConfig' ||
      input === 'AllExternalDependencies'
    ) {
      otherInputs.push(input);
      return;
    }
    if (input.includes(':')) {
      const [maybeProjectName, plan] = input.split(':');
      if (projectNames.includes(maybeProjectName)) {
        projectRootInputs.push({
          projectName: maybeProjectName,
          plan,
        });
        return;
      }
      externalInputs.push(input);
      return;
    }
  });
  return {
    workspaceRootInputs,
    projectRootInputs,
    externalInputs,
    otherInputs,
  };
}

/**
 * This function is used to get the expanded workspace root inputs
 * @param workspaceRootInputs e.g. ['{workspaceRoot}/apps/app/src/main.ts', '{workspaceRoot}/libs/lib/src/main.ts']
 * @param allWorkspaceFiles
 * @returns expand workspace root input file paths. e.g. { '{workspaceRoot}/apps/app/src/main.ts': ['apps/app/src/main.ts'], '{workspaceRoot}/libs/lib/src/main.ts': ['libs/lib/src/main.ts'] }
 */
function getExpandWorkspaceRootInputs(
  workspaceRootInputs: string[],
  allWorkspaceFiles: FileData[]
): { [plan: string]: string[] } {
  const matches: { [plan: string]: string[] } = {};
  workspaceRootInputs.forEach((plan) => {
    const withoutWorkspaceRoot = plan.substring('{workspaceRoot}'.length + 1);
    const matchingFile = allWorkspaceFiles.find(
      (t) => t.file === withoutWorkspaceRoot
    );
    if (matchingFile) {
      if (!matches[plan]) {
        matches[plan] = [];
      }
      matches[plan].push(matchingFile.file);
    } else {
      allWorkspaceFiles
        .filter((f) => minimatch(f.file, withoutWorkspaceRoot))
        .forEach((f) => {
          if (!matches[plan]) {
            matches[plan] = [];
          }
          matches[plan].push(f.file);
        });
    }
  });
  return matches;
}

/**
 * This function is used to get the expanded other inputs
 * @param otherInputs e.g. ['TsConfig', 'ProjectConfiguration', 'AllExternalDependencies']
 * @returns plan and file path for other inputs. e.g. { TsConfig: ['tsconfig.base.json'], ProjectConfiguration: ['project.json'], AllExternalDependencies: ['node_modules/**'] }
 */
function getExpandOtherInputs(otherInputs: string[]): {
  [plan: string]: string[];
} {
  const matches: { [plan: string]: string[] } = {};
  otherInputs.forEach((plan) => {
    if (plan === 'TsConfig') {
      matches[plan] = [getRootTsConfigPath()];
    } else if (plan === 'ProjectConfiguration') {
      matches[plan] = ['project.json'];
    } else {
      matches[plan] = [plan];
    }
  });
  return matches;
}

/**
 * This function is used to get the expanded project input
 * @param projectRootInputs e.g. ['app:src/main.ts', 'app:src/main2.ts']
 * @param depGraphClientResponse
 * @returns expand project input file paths mapped to the plan. e.g. {app: [{file: 'src/main.ts', plan: 'app:src/main.ts'}, {file: 'src/main2.ts', plan: 'app:src/main2.ts'}]}
 */
export function getExpandProjectInputs(
  projectRootInputs: {
    projectName: string;
    plan: string;
  }[],
  depGraphClientResponse: ProjectGraphClientResponse
): Record<
  string,
  {
    [plan: string]: string[];
  }
> {
  return projectRootInputs
    .map((input) => {
      const fileSetProject = depGraphClientResponse.projects?.find(
        (p) => p.name === input.projectName
      );
      const fileSets = input.plan.split(',');

      const matches: {
        [plan: string]: string[];
      } = {
        [input.plan]: filterUsingGlobPatterns(
          fileSetProject.data.root,
          depGraphClientResponse.fileMap[fileSetProject.name],
          fileSets
        ).map((f) => f.file),
      };
      const projectInputExpanded = {
        [input.projectName]: matches,
      };

      return projectInputExpanded;
    })
    .reduce((curr, acc) => {
      for (let key in curr) {
        acc[key] = curr[key];
      }
      return acc;
    }, {});
}

/**
 * Given a named input, it will return the file paths for the named input.
 * @param namedInput e.g. production
 * @param namedInputs e.g. {production: ['src/main.ts', 'src/main2.ts']}
 * @param projectName
 * @returns an array of file paths. e.g ['app:src/main.ts', 'app:src/main2.ts']
 */
export function getFilesForNamedInput(
  namedInput: string,
  namedInputs: { [inputName: string]: readonly (string | InputDefinition)[] },
  projectName: string
): string[] {
  return extractPatternsFromFileSets(
    expandNamedInput(namedInput, namedInputs)
  ).map((fileSet) => `${projectName}:${fileSet}`);
}

/**
 * This function is used to get files for dependencies inputs.
 * When depInput is { input: 'production', dependencies: true }, it will return all files for production and its dependencies.
 * When depInput is { input: 'production', dependencies: false } will return all files for production for project itself.
 * It will return a list of file paths. e.g ['angular:apps/app/src/main.ts', 'angular:ibs/lib/src/main.ts']
 */
export function getFilesForDepInput(
  project: ProjectGraphProjectNode,
  depInput: {
    input: string;
    dependencies: boolean;
  },
  projectGraphClientResponse: ProjectGraphClientResponse,
  namedInputs: { [inputName: string]: readonly (string | InputDefinition)[] },
  visited: string[] = [],
  isSelf: boolean = true
): string[] {
  let expandInputs: string[] = [];
  const projectFiles = getFilesForNamedInput(
    depInput.input,
    namedInputs,
    project.name
  );
  if (depInput.dependencies) {
    if (!isSelf) {
      expandInputs.push(...projectFiles);
    }
  } else {
    return projectFiles;
  }
  visited.push(project.name);

  const deps = projectGraphClientResponse.dependencies[project.name];
  deps.forEach((dep) => {
    if (visited.includes(dep.target)) return;

    const targetProject = projectGraphClientResponse.projects.find(
      (p) => p.name === dep.target
    );
    if (targetProject) {
      expandInputs.push(
        ...getFilesForDepInput(
          targetProject,
          depInput,
          projectGraphClientResponse,
          namedInputs,
          visited,
          false
        )
      );
    }
  });
  return expandInputs;
}
