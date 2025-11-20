import {
  type ExecutorContext,
  type ProjectGraphProjectNode,
  logger,
  workspaceRoot,
} from '@nx/devkit';
import { signalToCode } from '@nx/devkit/internal';
import { exec } from 'child_process';
import type { DockerReleasePublishSchema } from './schema';
import { existsSync, readFileSync } from 'fs';
import { getDockerVersionPath } from '../../release/version-utils';

export interface NormalizedDockerReleasePublishSchema {
  quiet: boolean;
  imageReference: string;
  dryRun: boolean;
}

export const LARGE_BUFFER = 1024 * 1000000;

export default async function dockerReleasePublish(
  schema: DockerReleasePublishSchema,
  context: ExecutorContext
) {
  const projectConfig = context.projectGraph.nodes[context.projectName];
  const options = await normalizeOptions(projectConfig, schema);
  if (!options.dryRun) {
    const digest = await dockerPush(options.imageReference, options.quiet);
    logger.log(
      `Successfully pushed ${options.imageReference}${
        options.quiet ? `. Digest: ${digest}` : ''
      }`
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

async function normalizeOptions(
  projectConfig: ProjectGraphProjectNode,
  schema: DockerReleasePublishSchema
): Promise<NormalizedDockerReleasePublishSchema> {
  return {
    quiet: schema.quiet ?? false,
    imageReference: await findImageReference(projectConfig, schema),
    dryRun: process.env.NX_DRY_RUN === 'true' || schema.dryRun || false,
  };
}

async function findImageReference(
  projectConfig: ProjectGraphProjectNode,
  schema: DockerReleasePublishSchema
) {
  let imageRef = readVersionFromFile(projectConfig.data.root);
  if (imageRef) {
    if (await checkDockerImageExistsLocally(imageRef)) {
      return imageRef;
    }
    throw new Error(
      `Could not find Docker Image ${imageRef}. Did you run 'nx release version'?`
    );
  }
}

function readVersionFromFile(projectRoot: string) {
  const versionFilePath = getDockerVersionPath(workspaceRoot, projectRoot);
  if (!existsSync(versionFilePath)) {
    throw new Error(
      `Could not find ${versionFilePath} file. Did you run 'nx release version'?`
    );
  }

  const version = readFileSync(versionFilePath, { encoding: 'utf8' });
  return version.trim();
}

async function checkDockerImageExistsLocally(imageRef: string) {
  try {
    return await new Promise((res) => {
      // If the ref starts with 'docker.io/', then we need to strip it since it is the default value and Docker CLI will not find it.
      const normalizedImageRef = imageRef.startsWith('docker.io/')
        ? imageRef.split('docker.io/')[1]
        : imageRef;
      const childProcess = exec(
        `docker images --filter "reference=${normalizedImageRef}" --quiet`,
        { encoding: 'utf8' }
      );
      let result = '';
      childProcess.stdout?.on('data', (data) => {
        result += data;
      });
      childProcess.stderr?.on('data', (data) => {
        console.error(data);
      });
      childProcess.on('error', (error) => {
        console.error('Docker command failed:', error);
        res(false);
      });
      childProcess.on('exit', () => {
        res(result.trim().length > 0);
      });
    });
  } catch {
    return false;
  }
}

async function dockerPush(imageReference: string, quiet: boolean) {
  try {
    return await new Promise((res, rej) => {
      const childProcess = exec(
        `docker push ${imageReference}${quiet ? ' --quiet' : ''}`,
        {
          encoding: 'utf8',
          maxBuffer: LARGE_BUFFER,
        }
      );
      let result = '';
      childProcess.stdout?.on('data', (data) => {
        result += data;
        if (!quiet) {
          console.log(data);
        }
      });
      childProcess.stderr?.on('data', (data) => {
        console.error(data);
      });
      childProcess.on('error', (error) => {
        rej(error);
      });
      childProcess.on('exit', (code, signal) => {
        if (code === null) code = signalToCode(signal);
        if (code === 0) {
          res(result.trim());
        } else {
          rej(new Error(`Docker push failed with exit code ${code}`));
        }
      });
    });
  } catch (e) {
    logger.error(`Failed to push ${imageReference}`);
    throw e;
  }
}
