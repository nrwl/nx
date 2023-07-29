import { addInitialRoutes } from '../../../utils/ast-utils';
import { NormalizedSchema } from '../schema';
import { reactRouterDomVersion } from '../../../utils/versions';
import {
  joinPathFragments,
  Tree,
  applyChangesToString,
  addDependenciesToPackageJson,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

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

function maybeJs(options: NormalizedSchema, path: string): string {
  return options.js && (path.endsWith('.ts') || path.endsWith('.tsx'))
    ? path.replace(/\.tsx?$/, '.js')
    : path;
}
