import {
  joinPathFragments,
  Tree,
  applyChangesToString,
  addDependenciesToPackageJson,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { addInitialRoutes } from '../../../utils/ast-utils';
import { reactRouterDomVersion } from '../../../utils/versions';
import { maybeJs } from '../../../utils/maybe-js';
import { NormalizedSchema } from '../schema';

let tsModule: typeof import('typescript');

export function addRouting(host: Tree, options: NormalizedSchema) {
  if (!options.routing) {
    return () => {};
  }

  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const appPath = joinPathFragments(
    options.appProjectRoot,
    maybeJs(options, `src/app/${options.fileName}.tsx`)
  );
  const appFileContent = host.read(appPath, 'utf-8');
  const appSource = tsModule.createSourceFile(
    appPath,
    appFileContent,
    tsModule.ScriptTarget.Latest,
    true
  );

  const changes = applyChangesToString(
    appFileContent,
    addInitialRoutes(appPath, appSource)
  );
  host.write(appPath, changes);

  if (!options.skipPackageJson) {
    return addDependenciesToPackageJson(
      host,
      { 'react-router-dom': reactRouterDomVersion },
      {}
    );
  }

  return () => {};
}
