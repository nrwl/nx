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
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import {
  reformattedWorkspaceJsonOrNull,
  workspaceConfigName,
} from '@nrwl/tao/src/shared/workspace';
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
    updateWorkspaceJsonToMatchFormatVersion(host);

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

function updateWorkspaceJsonToMatchFormatVersion(host: Tree) {
  const workspaceConfig = workspaceConfigName(appRootPath);

  try {
    if (workspaceConfig) {
      const workspaceJson = parseJson(host.read(workspaceConfig).toString());
      const reformatted = reformattedWorkspaceJsonOrNull(workspaceJson);
      if (reformatted) {
        host.overwrite(workspaceConfig, serializeJson(reformatted));
      }
    }
  } catch (e) {
    console.error(`Failed to format: ${path}`);
    console.error(e);
  }
}
