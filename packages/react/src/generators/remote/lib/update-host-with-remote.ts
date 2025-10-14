import {
  applyChangesToString,
  detectPackageManager,
  joinPathFragments,
  logger,
  names,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import {
  getProjectSourceRoot,
  isUsingTsSolutionSetup,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import {
  addRemoteRoute,
  addRemoteToConfig,
} from '../../../module-federation/ast-utils';

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

  const appComponentPath = findAppComponentPath(
    host,
    getProjectSourceRoot(hostConfig, host)
  );

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
      `Could not find configuration at ${moduleFederationConfigPath}. Did you generate this project with "@nx/react:host" or "@nx/react:consumer"?`
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
      `Could not find app component at ${appComponentPath}. Did you generate this project with "@nx/react:host" or "@nx/react:consumer"?`
    );
  }

  // Add remote as devDependency in TS solution setup
  if (isUsingTsSolutionSetup(host)) {
    addRemoteAsHostDependency(host, hostName, remoteName);
  }
}

function findAppComponentPath(host: Tree, sourceRoot: string) {
  const locations = [
    'app/app.tsx',
    'app/App.tsx',
    'app/app.js',
    'app/app.jsx',
    'app/App.js',
    'app/App.jsx',
    'app.tsx',
    'App.tsx',
    'app.js',
    'App.js',
    'app.jsx',
    'App.jsx',
  ];
  for (const loc of locations) {
    if (host.exists(joinPathFragments(sourceRoot, loc))) {
      return joinPathFragments(sourceRoot, loc);
    }
  }
}

function addRemoteAsHostDependency(
  tree: Tree,
  hostName: string,
  remoteName: string
) {
  const hostConfig = readProjectConfiguration(tree, hostName);
  const hostPackageJsonPath = joinPathFragments(
    hostConfig.root,
    'package.json'
  );

  if (!tree.exists(hostPackageJsonPath)) {
    throw new Error(
      `Host package.json not found at ${hostPackageJsonPath}. ` +
        `TypeScript solution setup requires package.json for all projects.`
    );
  }

  const packageManager = detectPackageManager(tree.root);
  // npm doesn't support workspace: protocol, use * instead
  const versionSpec = packageManager === 'npm' ? '*' : 'workspace:*';

  updateJson(tree, hostPackageJsonPath, (json) => {
    json.devDependencies ??= {};
    // Use simple remote name directly to match module-federation.config.ts
    json.devDependencies[remoteName] = versionSpec;
    return json;
  });
}
