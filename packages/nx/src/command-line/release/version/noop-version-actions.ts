import { VersionActions } from './version-actions';
import { Tree } from '../../../generators/tree';
import { NxReleaseVersionConfiguration } from '../../../config/nx-json';
import { ProjectGraph } from '../../../config/project-graph';

export class NOOP_VERSION_ACTIONS extends VersionActions {
  validManifestFilenames = null;

  readCurrentVersionFromRegistry(
    tree: Tree,
    currentVersionResolverMetadata: NxReleaseVersionConfiguration['currentVersionResolverMetadata']
  ): Promise<{
    currentVersion: string | null;
    logText: string;
  } | null> {
    return Promise.resolve(null);
  }

  readCurrentVersionFromSourceManifest(
    tree: Tree
  ): Promise<{ currentVersion: string; manifestPath: string } | null> {
    return Promise.resolve(null);
  }

  readCurrentVersionOfDependency(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependencyProjectName: string
  ): Promise<{
    currentVersion: string | null;
    dependencyCollection: string | null;
  }> {
    return Promise.resolve({
      currentVersion: null,
      dependencyCollection: null,
    });
  }

  updateProjectDependencies(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>
  ): Promise<string[]> {
    return Promise.resolve([]);
  }

  updateProjectVersion(tree: Tree, newVersion: string): Promise<string[]> {
    return Promise.resolve([]);
  }
}
