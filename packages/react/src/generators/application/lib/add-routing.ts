import {
  joinPathFragments,
  Tree,
  applyChangesToString,
  addDependenciesToPackageJson,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { addInitialRoutes } from '../../../utils/ast-utils.js';
import { reactRouterDomVersion } from '../../../utils/versions.js';
import { maybeJs } from '../../../utils/maybe-js.js';
import { NormalizedSchema } from '../schema.js';

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
    maybeJs(
      {
        js: options.js,
        useJsx: options.bundler === 'vite' || options.bundler === 'rspack',
      },
      `src/app/${options.fileName}.tsx`
    )
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
    addInitialRoutes(appPath, appSource, options.inSourceTests)
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
