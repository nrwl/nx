import { getGitRefContext, getRepoContext } from './git-context';
import { parseFlavor } from './flavor';
import { parseImages } from './image';
import { buildAnnotations, buildOciLabels } from './labels';
import { parseTags } from './tag';
import { buildTagStrings } from './tags-output';
import { ContainerMetadataOptions, ContainerMetadataResult } from './types';
import { resolveVersion } from './version-resolver';

export interface ComputeMetadataParams {
  options: ContainerMetadataOptions;
  projectRoot: string;
  workspaceRoot: string;
}

/**
 * Single entry point the build executor calls when `metadata.images` is configured. Wires the
 * pure image/tag/flavor/version-resolver/labels/tags-output modules to a local-git-derived
 * context, returning the tags/labels/annotations to merge into the engine build args.
 */
export function computeContainerMetadata(
  params: ComputeMetadataParams
): ContainerMetadataResult {
  const images = parseImages(params.options.images);
  const tags = parseTags(params.options.tags);
  const flavor = parseFlavor(params.options.flavor);

  const gitContext = getGitRefContext(params.workspaceRoot);
  const repoContext = getRepoContext(params.projectRoot, params.workspaceRoot);
  const now = new Date();

  const version = resolveVersion(
    tags,
    flavor,
    gitContext,
    repoContext.defaultBranch,
    now
  );

  return {
    version,
    tags: buildTagStrings(images, version, flavor),
    labels: buildOciLabels(
      repoContext,
      version,
      gitContext.sha,
      now,
      params.options.labels
    ),
    annotations: buildAnnotations(
      repoContext,
      version,
      gitContext.sha,
      now,
      params.options.annotations
    ),
  };
}
