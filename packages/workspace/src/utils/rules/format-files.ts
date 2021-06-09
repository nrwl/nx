import {
  CreateFileAction,
  noop,
  OverwriteFileAction,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { from } from 'rxjs';
import { filter, map, mergeMap } from 'rxjs/operators';
import * as path from 'path';
import { appRootPath } from '../../utilities/app-root';
import { reformattedWorkspaceJsonOrNull } from '@nrwl/tao/src/shared/workspace';
import { parseJson, serializeJson } from '@nrwl/devkit';

export function formatFiles(
  options: { skipFormat: boolean } = { skipFormat: false },
  directory: string = ''
): Rule {
  let prettier;
  try {
    prettier = require('prettier');
  } catch (e) {}

  if (options.skipFormat) {
    return noop();
  }

  return (host: Tree, context: SchematicContext) => {
    updateWorkspaceJsonToMatchFormatVersion(host, directory);
    sortWorkspaceJson(host, directory);
    sortNxJson(host);
    sortTsConfig(host);

    if (!prettier) {
      return host;
    }

    const files = new Set(
      host.actions
        .filter((action) => action.kind !== 'd' && action.kind !== 'r')
        .map((action: OverwriteFileAction | CreateFileAction) => ({
          path: action.path,
          content: action.content.toString(),
        }))
    );
    if (files.size === 0) {
      return host;
    }
    return from(files).pipe(
      filter((file) => host.exists(file.path)),
      mergeMap(async (file) => {
        const systemPath = path.join(appRootPath, file.path);
        let options: any = {
          filepath: systemPath,
        };
        const resolvedOptions = await prettier.resolveConfig(systemPath);
        if (resolvedOptions) {
          options = {
            ...options,
            ...resolvedOptions,
          };
        }
        const support = await prettier.getFileInfo(systemPath, options);
        if (support.ignored || !support.inferredParser) {
          return;
        }

        try {
          host.overwrite(file.path, prettier.format(file.content, options));
        } catch (e) {
          context.logger.warn(
            `Could not format ${file.path} because ${e.message}`
          );
        }
      }),
      map(() => host)
    );
  };
}

function getWorkspaceFile(host: Tree, directory: string) {
  const possibleFiles = [
    `${directory}/workspace.json`,
    `${directory}/angular.json`,
  ];
  const path = possibleFiles.filter((path) => host.exists(path))[0];
  return path;
}

function updateWorkspaceJsonToMatchFormatVersion(
  host: Tree,
  directory: string
) {
  const path = getWorkspaceFile(host, directory);
  try {
    if (path) {
      const workspaceJson = parseJson(host.read(path).toString());
      const reformatted = reformattedWorkspaceJsonOrNull(workspaceJson);
      if (reformatted) {
        host.overwrite(path, serializeJson(reformatted));
      }
    }
  } catch (e) {
    console.error(`Failed to format: ${path}`);
    console.error(e);
  }
}

function objectSort(originalObject: object) {
  return Object.keys(originalObject)
    .sort()
    .reduce((obj, key) => {
      obj[key] = originalObject[key];
      return obj;
    }, {});
}

function sortWorkspaceJson(host: Tree, directory: string) {
  const workspaceJsonPath = getWorkspaceFile(host, directory);
  try {
    const workspaceJson = parseJson(host.read(workspaceJsonPath).toString());
    const sortedProjects = objectSort(workspaceJson.projects);
    workspaceJson.projects = sortedProjects;
    host.overwrite(workspaceJsonPath, serializeJson(workspaceJson));
  } catch (e) {
    console.error(`failed to sort projects in ${workspaceJsonPath}`);
  }
}

function sortNxJson(host: Tree) {
  try {
    const nxJson = parseJson(host.read('nx.json').toString());
    const sortedProjects = objectSort(nxJson.projects);
    nxJson.projects = sortedProjects;
    host.overwrite('nx.json', serializeJson(nxJson));
  } catch (e) {
    console.error('failed to sort projects in nx.json');
  }
}

function sortTsConfig(host: Tree) {
  try {
    const tsconfig = parseJson(host.read('tsconfig.base.json').toString());
    const sortedPaths = objectSort(tsconfig.compilerOptions.paths);
    tsconfig.compilerOptions.paths = sortedPaths;
    host.overwrite('tsconfig.base.json', serializeJson(tsconfig));
  } catch (e) {
    console.error('failed to sort paths in tsconfig.base.json');
  }
}
