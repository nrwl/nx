import { ExecutorContext, ProjectGraphProjectNode, logger } from '@nx/devkit';
import { execSync } from 'child_process';
import {
  DockerReleasePublishSchema,
  NormalizedDockerReleasePublishSchema,
} from './schema';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { getDockerVersionPath } from '../../release/version-utils';

export default async function dockerReleasePublish(
  schema: DockerReleasePublishSchema,
  context: ExecutorContext
) {
  const projectConfig = context.projectGraph.nodes[context.projectName];
  const options = normalizeOptions(projectConfig, schema);
  if (!options.dryRun) {
    const digest = dockerPush(options.imageReference, options.quiet);
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
    quiet: schema.quiet ?? false,
    imageReference: findImageReference(projectConfig, schema),
    dryRun: process.env.NX_DRY_RUN === 'true' || schema.dryRun || false,
  };
}

function findImageReference(
  projectConfig: ProjectGraphProjectNode,
  schema: DockerReleasePublishSchema
) {
  let imageRef = readVersionFromFile(projectConfig.data.root);
  if (imageRef) {
    if (checkDockerImageExistsLocally(imageRef)) {
      return imageRef;
    }
    throw new Error(
      `Could not find Docker Image ${imageRef}. Did you run 'nx release version'?`
    );
  }
}

function readVersionFromFile(projectRoot: string) {
  const versionFilePath = getDockerVersionPath(projectRoot);
  if (!existsSync(versionFilePath)) {
    throw new Error(
      `Could not find ${versionFilePath} file. Did you run 'nx release version'?`
    );
  }

  const version = readFileSync(versionFilePath, { encoding: 'utf8' });
  return version.trim();
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

function dockerPush(imageReference: string, quiet: boolean) {
  try {
    const result = execSync(
      `docker push ${imageReference}${quiet ? ' --quiet' : ''}`,
      {
        encoding: 'utf8',
      }
    );
    return result.trim();
  } catch (e) {
    logger.error(`Failed to push ${imageReference}`);
    throw e;
  }
}
