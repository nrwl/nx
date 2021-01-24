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
import * as stripJsonComments from 'strip-json-comments';

let prettier;
try {
  prettier = require('prettier');
} catch (e) {}

export function formatFiles(
  options: { skipFormat: boolean } = { skipFormat: false },
  directory: string = ''
): Rule {
  if (options.skipFormat) {
    return noop();
  }

  return (host: Tree, context: SchematicContext) => {
    updateWorkspaceJsonToMatchFormatVersion(host, directory);

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

function updateWorkspaceJsonToMatchFormatVersion(
  host: Tree,
  directory: string
) {
  const possibleFiles = [
    `${directory}/workspace.json`,
    `${directory}/angular.json`,
  ];
  const path = possibleFiles.filter((path) => host.exists(path))[0];
  try {
    if (path) {
      const workspaceJson = JSON.parse(
        stripJsonComments(host.read(path).toString())
      );
      const reformatted = reformattedWorkspaceJsonOrNull(workspaceJson);
      if (reformatted) {
        host.overwrite(path, JSON.stringify(reformatted, null, 2));
      }
    }
  } catch (e) {
    console.error(`Failed to format: ${path}`);
    console.error(e);
  }
}
