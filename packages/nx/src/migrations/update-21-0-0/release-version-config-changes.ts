import { join } from 'node:path';
import type {
  LegacyNxReleaseVersionConfiguration,
  NxJsonConfiguration,
  NxReleaseVersionConfiguration,
} from '../../config/nx-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import type { Tree } from '../../generators/tree';
import { readJson, writeJson } from '../../generators/utils/json';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { getProjects } from '../../generators/utils/project-configuration';

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree) as NxJsonConfiguration;
  if (!nxJson) {
    return;
  }
  // If the user has explicitly set the useLegacyVersioning property to true, do nothing
  if (nxJson.release?.version?.useLegacyVersioning === true) {
    return;
  }

  function updateProperties(
    versionConfig: LegacyNxReleaseVersionConfiguration
  ) {
    // If the user is using a generator other than the @nx/js one, set useLegacyVersioning to true and nothing else
    if (
      'generator' in versionConfig &&
      versionConfig.generator !== '@nx/js:release-version'
    ) {
      (versionConfig as NxReleaseVersionConfiguration).useLegacyVersioning =
        true;
      return;
    }

    // These options used to live inside of generatorOptions, but are now like for like top-level nx core options
    const coreOptionsToPromoteToTopLevel = [
      'specifierSource',
      'currentVersionResolver',
      'currentVersionResolverMetadata',
      'fallbackCurrentVersionResolver',
      'versionPrefix',
      'updateDependents',
      'logUnchangedProjects',
    ];
    if ('generatorOptions' in versionConfig) {
      for (const option of coreOptionsToPromoteToTopLevel) {
        if (versionConfig.generatorOptions[option]) {
          versionConfig[option] = versionConfig.generatorOptions[option];
        }
      }

      // preserveLocalDependencyProtocols has changed to true by default, so remove it if explicitly true, otherwise set to false explicitly
      if (versionConfig.generatorOptions.preserveLocalDependencyProtocols) {
        delete versionConfig.generatorOptions.preserveLocalDependencyProtocols;
      } else {
        (
          versionConfig as NxReleaseVersionConfiguration
        ).preserveLocalDependencyProtocols = false;
      }

      // packageRoot has been replaced by manifestRootsToUpdate
      if (typeof versionConfig.generatorOptions.packageRoot === 'string') {
        (versionConfig as NxReleaseVersionConfiguration).manifestRootsToUpdate =
          [versionConfig.generatorOptions.packageRoot];
        delete versionConfig.generatorOptions.packageRoot;
      }

      // These options have been moved to versionActionsOptions
      const versionActionsOptions = [
        'skipLockFileUpdate',
        'installArgs',
        'installIgnoreScripts',
      ];
      for (const option of versionActionsOptions) {
        if (versionConfig.generatorOptions[option]) {
          (
            versionConfig as NxReleaseVersionConfiguration
          ).versionActionsOptions =
            (versionConfig as NxReleaseVersionConfiguration)
              .versionActionsOptions || {};
          (
            versionConfig as NxReleaseVersionConfiguration
          ).versionActionsOptions[option] =
            versionConfig.generatorOptions[option];
          delete versionConfig.generatorOptions[option];
        }
      }
      delete versionConfig.generatorOptions;
    }
  }

  // nx.json
  if (nxJson.release) {
    // Top level version config
    if (nxJson.release.version) {
      updateProperties(nxJson.release.version);
    }

    // Version config for each group
    if (nxJson.release.groups) {
      for (const group of Object.values(nxJson.release.groups)) {
        if (group.version) {
          updateProperties(group.version);
        }
      }
    }
  }

  // project.json or package.json
  const projects = getProjects(tree);
  for (const project of projects.values()) {
    const projectJsonPath = join(project.root, 'project.json');
    if (tree.exists(projectJsonPath)) {
      const projectJson = readJson(tree, projectJsonPath);
      if (projectJson.release?.version) {
        updateProperties(projectJson.release.version);
        writeJson(tree, projectJsonPath, projectJson);
      }
    }
    const packageJsonPath = join(project.root, 'package.json');
    if (tree.exists(packageJsonPath)) {
      const packageJson = readJson(tree, packageJsonPath);
      if (packageJson.nx?.release?.version) {
        updateProperties(packageJson.nx.release.version);
        writeJson(tree, packageJsonPath, packageJson);
      }
    }
  }

  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
