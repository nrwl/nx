import { join } from 'node:path';
import type {
  NxJsonConfiguration,
  NxReleaseConfiguration,
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

  function migrateReleaseTagConfig(config: any) {
    if (!config) {
      return;
    }

    // Check if any of the old properties exist
    const hasOldProperties =
      'releaseTagPattern' in config ||
      'releaseTagPatternCheckAllBranchesWhen' in config ||
      'releaseTagPatternRequireSemver' in config ||
      'releaseTagPatternPreferDockerVersion' in config ||
      'releaseTagPatternStrictPreid' in config;

    if (!hasOldProperties) {
      return;
    }

    // Create the new nested releaseTag object if it doesn't exist
    if (!config.releaseTag) {
      config.releaseTag = {};
    }

    // Migrate each property to the nested structure
    // Only migrate if the new property doesn't already exist (new format takes precedence)
    if ('releaseTagPattern' in config) {
      if (!('pattern' in config.releaseTag)) {
        config.releaseTag.pattern = config.releaseTagPattern;
      }
      delete config.releaseTagPattern;
    }

    if ('releaseTagPatternCheckAllBranchesWhen' in config) {
      if (!('checkAllBranchesWhen' in config.releaseTag)) {
        config.releaseTag.checkAllBranchesWhen =
          config.releaseTagPatternCheckAllBranchesWhen;
      }
      delete config.releaseTagPatternCheckAllBranchesWhen;
    }

    if ('releaseTagPatternRequireSemver' in config) {
      if (!('requireSemver' in config.releaseTag)) {
        config.releaseTag.requireSemver = config.releaseTagPatternRequireSemver;
      }
      delete config.releaseTagPatternRequireSemver;
    }

    if ('releaseTagPatternPreferDockerVersion' in config) {
      if (!('preferDockerVersion' in config.releaseTag)) {
        config.releaseTag.preferDockerVersion =
          config.releaseTagPatternPreferDockerVersion;
      }
      delete config.releaseTagPatternPreferDockerVersion;
    }

    if ('releaseTagPatternStrictPreid' in config) {
      if (!('strictPreid' in config.releaseTag)) {
        config.releaseTag.strictPreid = config.releaseTagPatternStrictPreid;
      }
      delete config.releaseTagPatternStrictPreid;
    }
  }

  // Migrate top-level release configuration in nx.json
  if (nxJson.release) {
    migrateReleaseTagConfig(nxJson.release);

    // Migrate release groups configuration
    if (nxJson.release.groups) {
      for (const group of Object.values(nxJson.release.groups)) {
        migrateReleaseTagConfig(group);
      }
    }
  }

  // Migrate project-level configuration in project.json and package.json
  const projects = getProjects(tree);
  for (const project of projects.values()) {
    // Check project.json
    const projectJsonPath = join(project.root, 'project.json');
    if (tree.exists(projectJsonPath)) {
      const projectJson = readJson(tree, projectJsonPath);
      if (projectJson.release) {
        migrateReleaseTagConfig(projectJson.release);
        writeJson(tree, projectJsonPath, projectJson);
      }
    }

    // Check package.json
    const packageJsonPath = join(project.root, 'package.json');
    if (tree.exists(packageJsonPath)) {
      const packageJson = readJson(tree, packageJsonPath);
      if (packageJson.nx?.release) {
        migrateReleaseTagConfig(packageJson.nx.release);
        writeJson(tree, packageJsonPath, packageJson);
      }
    }
  }

  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
