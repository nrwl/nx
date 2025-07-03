import { VersionActions, VersionScheme } from 'nx/release';
import type { NxReleaseVersionConfiguration } from 'nx/src/config/nx-json';
import {
  joinPathFragments,
  ProjectGraph,
  type ProjectGraphDependency,
  Tree,
} from '@nx/devkit';
import { execSync } from 'child_process';
import {
  DockerVersionActionsOptions,
  normalizeVersionPattern,
} from './version-actions-options';
import { interpolateVersionPattern } from './version-pattern-utils';

type NxReleaseProjectConfiguration = Pick<
  // Expose a subset of version config options at the project level
  NxReleaseVersionConfiguration,
  | 'versionActions'
  | 'versionActionsOptions'
  | 'manifestRootsToUpdate'
  | 'currentVersionResolver'
  | 'currentVersionResolverMetadata'
  | 'fallbackCurrentVersionResolver'
  | 'versionPrefix'
  | 'preserveLocalDependencyProtocols'
>;

export default class DockerVersionActions extends VersionActions {
  validManifestFilenames: string[] = ['Dockerfile'];
  isDryRun = process.env.NX_DRY_RUN === 'true';
  defaultVersionPattern = `{currentDate|YYMM.DD}.{shortCommitSha}`;
  versionPatterns = normalizeVersionPattern(
    this.finalConfigForProject.versionActionsOptions?.versionPattern ?? {}
  );

  async getVersionScheme(): Promise<VersionScheme> {
    return Promise.resolve('custom');
  }

  async readCurrentVersionFromSourceManifest(
    tree: Tree
  ): Promise<{ currentVersion: string; manifestPath: string } | null> {
    return null;
  }

  async readCurrentVersionFromRegistry(
    tree: Tree,
    currentVersionResolverMetadata: NxReleaseVersionConfiguration['currentVersionResolverMetadata']
  ): Promise<{ currentVersion: string | null; logText: string } | null> {
    return null;
  }

  async readCurrentVersionOfDependency(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependencyProjectName: string
  ): Promise<{
    currentVersion: string | null;
    dependencyCollection: string | null;
  }> {
    // Docker does not require reading versions of dependencies
    return {
      currentVersion: null,
      dependencyCollection: null,
    };
  }

  async calculateNewVersion(
    currentVersion: string | null,
    newVersionInput: string,
    newVersionInputReason: string,
    newVersionInputReasonData: Record<string, unknown>,
    preid: string
  ): Promise<{
    newVersion: string;
    logText: string;
  }> {
    let newVersion = [
      'major',
      'premajor',
      'minor',
      'preminor',
      'patch',
      'prepatch',
      'prerelease',
    ].some((v) => v === newVersionInput)
      ? this.versionPatterns[newVersionInput] || this.defaultVersionPattern
      : newVersionInput;

    newVersion = interpolateVersionPattern(newVersion, {
      projectName: this.projectGraphNode.name,
    });

    return {
      newVersion,
      logText: `New version applied: ${newVersion}`,
    };
  }

  async readDependencies(
    tree: Tree,
    projectGraph: ProjectGraph
  ): Promise<ProjectGraphDependency[]> {
    // Docker has no need to read dependent projects from the graph
    return [];
  }

  async updateProjectVersion(
    tree: Tree,
    newVersion: string
  ): Promise<string[]> {
    const imageRef = this.getDefaultImageReference();
    const newImageRef = this.getImageReference();
    if (!this.isDryRun) {
      execSync(`docker tag ${imageRef} ${newImageRef}:${newVersion}`);
    }
    const logs = [
      `Image ${imageRef} tagged with ${newImageRef}:${newVersion}.`,
    ];
    if (this.isDryRun) {
      logs.push(`No changes were applied as --dry-run is enabled.`);
    }
    tree.write(
      joinPathFragments(this.projectGraphNode.data.root, '.docker-version'),
      newVersion
    );
    return logs;
  }

  async updateProjectDependencies(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>
  ): Promise<string[]> {
    // Dockerfiles manage dependent images and versions internally
    return [];
  }

  private getImageReference() {
    const versionActionsOptions: DockerVersionActionsOptions =
      this.finalConfigForProject.versionActionsOptions ?? {};

    let imageRef =
      versionActionsOptions.repositoryName ?? this.getDefaultImageReference();

    if (versionActionsOptions.registry) {
      imageRef = `${versionActionsOptions.registry}/${imageRef}`;
    }
    return imageRef;
  }

  private getDefaultImageReference() {
    return this.projectGraphNode.data.root
      .replace(/^[\\/]/, '')
      .replace(/[\\/\s]+/g, '-');
  }
}
