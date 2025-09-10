import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { prompt } from 'enquirer';
import type { ProjectGraphProjectNode } from '@nx/devkit';
import type { FinalConfigForProject } from 'nx/src/command-line/release/version/release-group-processor';
import { interpolateVersionPattern } from './version-pattern-utils';

const DEFAULT_VERSION_SCHEMES = {
  production: '{currentDate|YYMM.DD}.{shortCommitSha}',
  hotfix: '{currentDate|YYMM.DD}.{shortCommitSha}-hotfix',
};

export const getDockerVersionPath = (
  workspaceRoot: string,
  projectRoot: string
) => {
  return join(workspaceRoot, 'tmp', projectRoot, '.docker-version');
};

export async function handleDockerVersion(
  workspaceRoot: string,
  projectGraphNode: ProjectGraphProjectNode,
  finalConfigForProject: FinalConfigForProject,
  dockerVersionScheme?: string,
  dockerVersion?: string
) {
  // If the full docker image reference is provided, use it directly
  const nxDockerImageRefEnvOverride =
    process.env.NX_DOCKER_IMAGE_REF?.trim() || undefined;
  // If an explicit dockerVersion is provided, use it directly
  let newVersion: string | undefined;

  if (!nxDockerImageRefEnvOverride) {
    if (dockerVersion) {
      newVersion = dockerVersion;
    } else {
      const availableVersionSchemes =
        finalConfigForProject.dockerOptions.versionSchemes ??
        DEFAULT_VERSION_SCHEMES;
      const versionScheme =
        dockerVersionScheme && dockerVersionScheme in availableVersionSchemes
          ? dockerVersionScheme
          : await promptForNewVersion(
              availableVersionSchemes,
              projectGraphNode.name
            );
      newVersion = calculateNewVersion(
        projectGraphNode.name,
        versionScheme,
        availableVersionSchemes
      );
    }
  }

  const logs = updateProjectVersion(
    newVersion,
    nxDockerImageRefEnvOverride,
    workspaceRoot,
    projectGraphNode.data.root,
    finalConfigForProject.dockerOptions.repositoryName,
    finalConfigForProject.dockerOptions.registryUrl
  );

  return {
    newVersion: newVersion || (process.env.NX_DOCKER_IMAGE_REF?.split(':')[1] || null),
    logs,
  };
}

async function promptForNewVersion(
  versionSchemes: Record<string, string>,
  projectName: string
) {
  const { versionScheme } = await prompt<{ versionScheme: string }>({
    name: 'versionScheme',
    type: 'select',
    message: `What type of docker release would you like to make for project "${projectName}"?`,
    choices: Object.keys(versionSchemes).map((vs) => ({
      name: vs,
      message: vs,
      value: vs,
      hint: interpolateVersionPattern(versionSchemes[vs], { projectName }),
    })),
  });

  return versionScheme;
}

function calculateNewVersion(
  projectName: string,
  versionScheme: string,
  versionSchemes: Record<string, string>
): string {
  if (!(versionScheme in versionSchemes)) {
    throw new Error(
      `Could not find version scheme '${versionScheme}'. Available options are: ${Object.keys(
        versionSchemes
      ).join(', ')}.`
    );
  }
  return interpolateVersionPattern(versionSchemes[versionScheme], {
    projectName,
  });
}

function updateProjectVersion(
  newVersion: string | undefined,
  nxDockerImageRefEnvOverride: string | undefined,
  workspaceRoot: string,
  projectRoot: string,
  repositoryName?: string,
  registry?: string
): string[] {
  const isDryRun = process.env.NX_DRY_RUN && process.env.NX_DRY_RUN !== 'false';
  const imageRef = getDefaultImageReference(projectRoot);
  const newImageRef = getImageReference(projectRoot, repositoryName, registry);
  const fullImageRef =
    nxDockerImageRefEnvOverride ?? `${newImageRef}:${newVersion}`;
  if (!isDryRun) {
    execSync(`docker tag ${imageRef} ${fullImageRef}`);
  }
  const logs = isDryRun
    ? [`Image would be tagged with ${fullImageRef} but dry run is enabled.`]
    : [`Image tagged with ${fullImageRef}.`];
  if (isDryRun) {
    logs.push(`No changes were applied as --dry-run is enabled.`);
  } else {
    const dockerVersionPath = getDockerVersionPath(workspaceRoot, projectRoot);
    mkdirSync(dirname(dockerVersionPath), { recursive: true });
    writeFileSync(dockerVersionPath, fullImageRef);
  }
  return logs;
}

function getImageReference(
  projectRoot: string,
  repositoryName?: string,
  registry?: string
) {
  let imageRef = repositoryName ?? getDefaultImageReference(projectRoot);

  if (registry) {
    imageRef = `${registry}/${imageRef}`;
  }
  return imageRef;
}

function getDefaultImageReference(projectRoot: string) {
  return projectRoot.replace(/^[\\/]/, '').replace(/[\\/\s]+/g, '-');
}
