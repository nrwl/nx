import {
  applyChangesToString,
  joinPathFragments,
  logger,
  names,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import {
  addRemoteRoute,
  addRemoteToConfig,
} from '../../../module-federation/ast-utils';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

export function updateHostWithRemote(
  host: Tree,
  hostName: string,
  remoteName: string
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const hostConfig = readProjectConfiguration(host, hostName);

  let moduleFederationConfigPath = joinPathFragments(
    hostConfig.root,
    'module-federation.config.js'
  );

  if (!host.exists(moduleFederationConfigPath)) {
    moduleFederationConfigPath = joinPathFragments(
      hostConfig.root,
      'module-federation.config.ts'
    );
  }

  const appComponentPath = findAppComponentPath(host, hostConfig.sourceRoot);

  if (host.exists(moduleFederationConfigPath)) {
    // find the host project path
    // Update remotes inside ${host_path}/src/remotes.d.ts
    let sourceCode = host.read(moduleFederationConfigPath).toString();
    const source = tsModule.createSourceFile(
      moduleFederationConfigPath,
      sourceCode,
      tsModule.ScriptTarget.Latest,
      true
    );
    host.write(
      moduleFederationConfigPath,
      applyChangesToString(sourceCode, addRemoteToConfig(source, remoteName))
    );
  } else {
    // TODO(jack): Point to the nx.dev guide when ready.
    logger.warn(
      `Could not find configuration at ${moduleFederationConfigPath}. Did you generate this project with "@nx/react:host"?`
    );
  }

  if (host.exists(appComponentPath)) {
    let sourceCode = host.read(appComponentPath).toString();
    const source = tsModule.createSourceFile(
      moduleFederationConfigPath,
      sourceCode,
      tsModule.ScriptTarget.Latest,
      true,
      tsModule.ScriptKind.TSX
    );
    host.write(
      appComponentPath,
      applyChangesToString(
        sourceCode,
        addRemoteRoute(source, names(remoteName))
      )
    );
  } else {
    logger.warn(
      `Could not find app component at ${appComponentPath}. Did you generate this project with "@nx/react:host"?`
    );
  }
}

function findAppComponentPath(host: Tree, sourceRoot: string) {
  const locations = [
    'app/app.tsx',
    'app/App.tsx',
    'app/app.js',
    'app/App.js',
    'app.tsx',
    'App.tsx',
    'app.js',
    'App.js',
  ];
  for (const loc of locations) {
    if (host.exists(joinPathFragments(sourceRoot, loc))) {
      return joinPathFragments(sourceRoot, loc);
    }
  }
}
