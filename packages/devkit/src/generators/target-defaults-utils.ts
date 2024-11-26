import {
  type CreateNodes,
  type CreateNodesV2,
  type PluginConfiguration,
  type Tree,
  readNxJson,
  updateNxJson,
} from 'nx/src/devkit-exports';
import { findMatchingConfigFiles } from 'nx/src/devkit-internals';

export function addBuildTargetDefaults(
  tree: Tree,
  executorName: string,
  buildTargetName = 'build'
): void {
  const nxJson = readNxJson(tree);
  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults[executorName] ??= {
    cache: true,
    dependsOn: [`^${buildTargetName}`],
    inputs:
      nxJson.namedInputs && 'production' in nxJson.namedInputs
        ? ['production', '^production']
        : ['default', '^default'],
  };
  updateNxJson(tree, nxJson);
}

export async function addE2eCiTargetDefaults(
  tree: Tree,
  e2ePlugin: string,
  buildTarget: string,
  pathToE2EConfigFile: string
): Promise<void> {
  const nxJson = readNxJson(tree);
  if (!nxJson.plugins) {
    return;
  }

  const e2ePluginRegistrations = nxJson.plugins.filter((p) =>
    typeof p === 'string' ? p === e2ePlugin : p.plugin === e2ePlugin
  );
  if (!e2ePluginRegistrations.length) {
    return;
  }

  const resolvedE2ePlugin: {
    createNodes?: CreateNodes;
    createNodesV2?: CreateNodesV2;
  } = await import(e2ePlugin);
  const e2ePluginGlob =
    resolvedE2ePlugin.createNodesV2?.[0] ?? resolvedE2ePlugin.createNodes?.[0];

  let foundPluginForApplication: PluginConfiguration;
  for (let i = 0; i < e2ePluginRegistrations.length; i++) {
    let candidatePluginForApplication = e2ePluginRegistrations[i];
    if (typeof candidatePluginForApplication === 'string') {
      foundPluginForApplication = candidatePluginForApplication;
      break;
    }

    const matchingConfigFiles = findMatchingConfigFiles(
      [pathToE2EConfigFile],
      e2ePluginGlob,
      candidatePluginForApplication.include,
      candidatePluginForApplication.exclude
    );

    if (matchingConfigFiles.length) {
      foundPluginForApplication = candidatePluginForApplication;
      break;
    }
  }

  if (!foundPluginForApplication) {
    return;
  }

  const ciTargetName =
    typeof foundPluginForApplication === 'string'
      ? 'e2e-ci'
      : (foundPluginForApplication.options as any)?.ciTargetName ?? 'e2e-ci';

  const ciTargetNameGlob = `${ciTargetName}--**/*`;
  nxJson.targetDefaults ??= {};
  const e2eCiTargetDefaults = nxJson.targetDefaults[ciTargetNameGlob];
  if (!e2eCiTargetDefaults) {
    nxJson.targetDefaults[ciTargetNameGlob] = {
      dependsOn: [buildTarget],
    };
  } else {
    e2eCiTargetDefaults.dependsOn ??= [];
    if (!e2eCiTargetDefaults.dependsOn.includes(buildTarget)) {
      e2eCiTargetDefaults.dependsOn.push(buildTarget);
    }
  }
  updateNxJson(tree, nxJson);
}
