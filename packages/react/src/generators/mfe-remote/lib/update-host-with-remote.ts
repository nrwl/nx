import {
  applyChangesToString,
  joinPathFragments,
  logger,
  names,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import {
  addRemoteDefinition,
  addRemoteRoute,
  addRemoteToMfeConfig,
} from '../../../mfe/mfe-ast-utils';
import * as ts from 'typescript';

export function updateHostWithRemote(
  host: Tree,
  hostName: string,
  remoteName: string
) {
  const hostConfig = readProjectConfiguration(host, hostName);
  const mfeConfigPath = joinPathFragments(hostConfig.root, 'mfe.config.js');
  const remoteDefsPath = joinPathFragments(
    hostConfig.sourceRoot,
    'remotes.d.ts'
  );
  const appComponentPath = findAppComponentPath(host, hostConfig.sourceRoot);

  if (host.exists(mfeConfigPath)) {
    // find the host project path
    // Update remotes inside ${host_path}/src/remotes.d.ts
    let sourceCode = host.read(mfeConfigPath).toString();
    const source = ts.createSourceFile(
      mfeConfigPath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );
    host.write(
      mfeConfigPath,
      applyChangesToString(sourceCode, addRemoteToMfeConfig(source, remoteName))
    );
  } else {
    // TODO(jack): Point to the nx.dev guide when ready.
    logger.warn(
      `Could not find MFE configuration at ${mfeConfigPath}. Did you generate this project with "@nrwl/react:mfe-host"?`
    );
  }

  if (host.exists(remoteDefsPath)) {
    let sourceCode = host.read(remoteDefsPath).toString();
    const source = ts.createSourceFile(
      mfeConfigPath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );
    host.write(
      remoteDefsPath,
      applyChangesToString(sourceCode, addRemoteDefinition(source, remoteName))
    );
  } else {
    logger.warn(
      `Could not find remote definitions at ${remoteDefsPath}. Did you generate this project with "@nrwl/react:mfe-host"?`
    );
  }

  if (host.exists(appComponentPath)) {
    let sourceCode = host.read(appComponentPath).toString();
    const source = ts.createSourceFile(
      mfeConfigPath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
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
      `Could not find app component at ${appComponentPath}. Did you generate this project with "@nrwl/react:mfe-host"?`
    );
  }
}

function findAppComponentPath(host: Tree, sourceRoot: string) {
  const locations = ['app/app.tsx', 'app/App.tsx', 'app.tsx', 'App.tsx'];
  for (const loc of locations) {
    if (host.exists(joinPathFragments(sourceRoot, loc))) {
      return joinPathFragments(sourceRoot, loc);
    }
  }
}
