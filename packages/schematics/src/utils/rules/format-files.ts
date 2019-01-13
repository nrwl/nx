import {
  Tree,
  SchematicContext,
  Rule,
  noop,
  OverwriteFileAction,
  CreateFileAction
} from '@angular-devkit/schematics';
import { format, resolveConfig, getFileInfo } from 'prettier';
import * as appRoot from 'app-root-path';
import { from, Observable } from 'rxjs';
import { concatMap, delay, filter, map, mergeMap } from 'rxjs/operators';

export function formatFiles(
  options: { skipFormat: boolean } = { skipFormat: false }
): Rule {
  if (options.skipFormat) {
    return noop();
  }
  return (host: Tree, context: SchematicContext) => {
    const files = new Set(
      host.actions
        .filter(action => action.kind !== 'd' && action.kind !== 'r')
        .map((action: OverwriteFileAction | CreateFileAction) => ({
          path: action.path,
          content: action.content.toString()
        }))
    );
    if (files.size === 0) {
      return host;
    }
    return from(files).pipe(
      filter(file => host.exists(file.path)),
      mergeMap(async file => {
        const systemPath = appRoot.resolve(file.path);
        let options: any = {
          filepath: systemPath
        };
        const resolvedOptions = await resolveConfig(systemPath);
        if (resolvedOptions) {
          options = {
            ...options,
            ...resolvedOptions
          };
        }
        const support = await getFileInfo(systemPath, options);
        if (support.ignored || !support.inferredParser) {
          return;
        }

        try {
          host.overwrite(file.path, format(file.content, options));
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
