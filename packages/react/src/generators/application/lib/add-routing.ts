import {
  joinPathFragments,
  Tree,
  applyChangesToString,
  addDependenciesToPackageJson,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import { addInitialRoutes } from '../../../utils/ast-utils';
import { reactRouterDomVersion } from '../../../utils/versions';
import { maybeJs } from '../../../utils/maybe-js';
import { NormalizedSchema } from '../schema';
import type { TypescriptAst } from '@nx/devkit/internal';

let tsModule: TypescriptAst;

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
      {},
      undefined,
      true
    );
  }

  return () => {};
}
