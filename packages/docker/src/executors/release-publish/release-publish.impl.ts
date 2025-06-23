import { ExecutorContext, ProjectGraphProjectNode, logger } from '@nx/devkit';
import type { NxReleaseVersionConfiguration } from 'nx/src/config/nx-json';
import { execSync } from 'child_process';
import {
  DockerReleasePublishSchema,
  NormalizedDockerReleasePublishSchema,
} from './schema';
import { DockerVersionActionsOptions } from '../../release/version-actions-options';

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

export default async function dockerReleasePublish(
  schema: DockerReleasePublishSchema,
  context: ExecutorContext
) {
  const projectConfig = context.projectGraph.nodes[context.projectName];
  const options = normalizeOptions(projectConfig, schema);
  if (!options.dryRun) {
    const digest = dockerPush(options.imageReference);
    logger.log(
      `Successfully pushed ${options.imageReference}. Digest: ${digest}`
    );
  } else {
    logger.log(
      `Docker Image ${options.imageReference} was not pushed as --dry-run is enabled.`
    );
  }
  return {
    success: true,
  };
}

function normalizeOptions(
  projectConfig: ProjectGraphProjectNode,
  schema: DockerReleasePublishSchema
): NormalizedDockerReleasePublishSchema {
  return {
    imageReference: findImageReference(projectConfig, schema),
    dryRun: process.env.NX_DRY_RUN === 'true' || schema.dryRun || false,
  };
}

function findImageReference(
  projectConfig: ProjectGraphProjectNode,
  schema: DockerReleasePublishSchema
) {
  const versionActionsOptions: DockerVersionActionsOptions =
    (projectConfig.data?.release?.version as NxReleaseProjectConfiguration)
      ?.versionActionsOptions ?? {};
  let imageRef = '';
  if (schema.version) {
    imageRef = `${schema.version}`;
  }
  if (schema.repositoryName || versionActionsOptions.repositoryName) {
    imageRef = `${
      schema.repositoryName ?? versionActionsOptions.repositoryName
    }${imageRef ? `:${imageRef}` : ''}`;
  }
  if (schema.registry || versionActionsOptions.registry) {
    imageRef = `${schema.registry ?? versionActionsOptions.registry}${
      imageRef ? `/${imageRef}` : ''
    }`;
  }
  if (imageRef) {
    if (checkDockerImageExistsLocally(imageRef)) {
      return imageRef;
    }
    throw new Error(
      `Could not find Docker Image ${imageRef}. Did you run 'nx release version'?`
    );
  }
}

function checkDockerImageExistsLocally(imageRef: string) {
  try {
    const result = execSync(
      `docker images --filter "reference=${imageRef}" --quiet`,
      { encoding: 'utf8' }
    );
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

function dockerPush(imageReference: string) {
  try {
    const result = execSync(`docker push ${imageReference} --quiet`, {
      encoding: 'utf8',
    });
    return result.trim();
  } catch (e) {
    logger.error(`Failed to push ${imageReference}`);
    throw e;
  }
}
