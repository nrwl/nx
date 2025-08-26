import { logger, ProjectGraph, workspaceRoot } from '@nx/devkit';
import { getModuleFederationConfig, ModuleFederationConfig } from '../../utils';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function getRemotes(
  config: ModuleFederationConfig,
  projectGraph: ProjectGraph,
  pathToManifestFile?: string
) {
  const collectedRemotes = new Set<string>();
  const { remotes, dynamicRemotes } = extractRemoteProjectsFromConfig(
    config,
    pathToManifestFile
  );
  remotes.forEach((r) =>
    collectRemoteProjects(r, collectedRemotes, projectGraph)
  );

  // With dynamic remotes, the manifest file may contain the names with `_` due to MF limitations on naming
  // The project graph might contain these names with `-` rather than `_`. Check for both.
  // This can occur after migration of existing remotes past Nx 19.8
  let normalizedDynamicRemotes = dynamicRemotes.map((r) => {
    if (projectGraph.nodes[r.replace(/_/g, '-')]) {
      return r.replace(/_/g, '-');
    }
    return r;
  });
  const knownDynamicRemotes = normalizedDynamicRemotes.filter(
    (r) => projectGraph.nodes[r]
  );
  knownDynamicRemotes.forEach((r) =>
    collectRemoteProjects(r, collectedRemotes, projectGraph)
  );
  const remotePorts = [...collectedRemotes, ...knownDynamicRemotes].map(
    (r) => projectGraph.nodes[r].data.targets['serve'].options.port
  );
  const staticRemotePort = Math.max(...([...remotePorts] as number[])) + 1;

  return {
    remotes: Array.from(collectedRemotes),
    remotePorts,
    staticRemotePort,
  };
}

function extractRemoteProjectsFromConfig(
  config: ModuleFederationConfig,
  pathToManifestFile?: string
) {
  const remotes = [];
  const dynamicRemotes = [];
  if (pathToManifestFile && existsSync(pathToManifestFile)) {
    const moduleFederationManifestJson = readFileSync(
      pathToManifestFile,
      'utf-8'
    );

    if (moduleFederationManifestJson) {
      // This should have shape of
      // {
      //   "remoteName": "remoteLocation",
      // }
      const parsedManifest = JSON.parse(moduleFederationManifestJson);
      if (
        Object.keys(parsedManifest).every(
          (key) =>
            typeof key === 'string' && typeof parsedManifest[key] === 'string'
        )
      ) {
        dynamicRemotes.push(...Object.keys(parsedManifest));
      }
    }
  }
  const staticRemotes =
    config.remotes?.map((r) => (Array.isArray(r) ? r[0] : r)) ?? [];
  remotes.push(...staticRemotes);
  return { remotes, dynamicRemotes };
}

function collectRemoteProjects(
  remote: string,
  collected: Set<string>,
  projectGraph: ProjectGraph
) {
  const remoteProject = projectGraph.nodes[remote]?.data;
  if (!projectGraph.nodes[remote] || collected.has(remote)) {
    return;
  }

  collected.add(remote);

  const remoteProjectRoot = remoteProject.root;
  let remoteProjectTsConfig = ['tsconfig.app.json', 'tsconfig.json']
    .map((p) => join(workspaceRoot, remoteProjectRoot, p))
    .find((p) => existsSync(p));
  const remoteProjectConfig = getModuleFederationConfig(
    remoteProjectTsConfig,
    workspaceRoot,
    remoteProjectRoot
  );
  const { remotes: remoteProjectRemotes } =
    extractRemoteProjectsFromConfig(remoteProjectConfig);

  remoteProjectRemotes.forEach((r) =>
    collectRemoteProjects(r, collected, projectGraph)
  );
}
