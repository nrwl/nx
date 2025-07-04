import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { prompt } from 'enquirer';
import { ProjectGraphProjectNode } from '@nx/devkit';
import type { FinalConfigForProject } from 'nx/src/command-line/release/version/release-group-processor';
import { interpolateVersionPattern } from './version-pattern-utils';

const DEFAULT_VERSION_SCHEMES = {
  production: '{currentDate|YYMM.DD}.{shortCommitSha}',
  hotfix: '{currentDate|YYMM.DD}.{shortCommitSha}-hotfix',
};

export async function handleDockerVersion(
  projectGraphNode: ProjectGraphProjectNode,
  finalConfigForProject: FinalConfigForProject
) {
  const availableVersionSchemes =
    finalConfigForProject.dockerOptions.versionSchemes ??
    DEFAULT_VERSION_SCHEMES;
  const versionScheme = await promptForNewVersion(
    availableVersionSchemes,
    projectGraphNode.name
  );
  const newVersion = calculateNewVersion(
    projectGraphNode.name,
    versionScheme,
    availableVersionSchemes
  );
  const logs = updateProjectVersion(
    newVersion,
    projectGraphNode.data.root,
    finalConfigForProject.dockerOptions.repositoryName,
    finalConfigForProject.dockerOptions.registryUrl
  );
  return {
    newVersion,
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
    message: `What type of release would you like to make for project "${projectName}"?`,
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
  newVersion: string,
  projectRoot: string,
  repositoryName?: string,
  registry?: string
): string[] {
  const isDryRun = process.env.NX_DRY_RUN && process.env.NX_DRY_RUN !== 'false';
  const imageRef = getDefaultImageReference(projectRoot);
  const newImageRef = getImageReference(projectRoot, repositoryName, registry);
  const fullImageRef = `${newImageRef}:${newVersion}`;
  if (!isDryRun) {
    execSync(`docker tag ${imageRef} ${fullImageRef}`);
  }
  const logs = [`Image ${imageRef} tagged with ${fullImageRef}.`];
  if (isDryRun) {
    logs.push(`No changes were applied as --dry-run is enabled.`);
  } else {
    writeFileSync(join(projectRoot, '.docker-version'), fullImageRef);
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
