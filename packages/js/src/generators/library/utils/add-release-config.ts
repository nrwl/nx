import {
  GeneratorCallback,
  getPackageManagerCommand,
  joinPathFragments,
  output,
  ProjectConfiguration,
  ProjectGraphProjectNode,
  readNxJson,
  runTasksInSerial,
  Tree,
  writeJson,
} from '@nx/devkit';
import { findMatchingProjects } from 'nx/src/utils/find-matching-projects';
import setupVerdaccio from '../../setup-verdaccio/generator';

/**
 * Adds release option in nx.json to build the project before versioning
 */
export async function addReleaseConfigForTsSolution(
  tree: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration
): Promise<void> {
  const nxJson = readNxJson(tree);

  const addPreVersionCommand = () => {
    const pmc = getPackageManagerCommand();

    nxJson.release = {
      ...nxJson.release,
      version: {
        preVersionCommand: `${pmc.dlx} nx run-many -t build`,
        ...nxJson.release?.version,
      },
    };
  };

  // if the release configuration does not exist, it will be created
  if (!nxJson.release || (!nxJson.release.projects && !nxJson.release.groups)) {
    // skip adding any projects configuration since the new project should be
    // automatically included by nx release's default project detection logic
    addPreVersionCommand();
    writeJson(tree, 'nx.json', nxJson);
    return;
  }

  const project: ProjectGraphProjectNode = {
    name: projectName,
    type: 'lib' as const,
    data: {
      root: projectConfiguration.root,
      tags: projectConfiguration.tags,
    },
  };

  // if the project is already included in the release configuration, it will not be added again
  if (projectsConfigMatchesProject(nxJson.release.projects, project)) {
    output.log({
      title: `Project already included in existing release configuration`,
    });
    addPreVersionCommand();
    writeJson(tree, 'nx.json', nxJson);
    return;
  }

  // if the release configuration is a string, it will be converted to an array and added to it
  if (Array.isArray(nxJson.release.projects)) {
    nxJson.release.projects.push(projectName);
    addPreVersionCommand();
    writeJson(tree, 'nx.json', nxJson);
    output.log({
      title: `Added project to existing release configuration`,
    });
  }

  if (nxJson.release.groups) {
    const allGroups = Object.entries(nxJson.release.groups);

    for (const [name, group] of allGroups) {
      if (projectsConfigMatchesProject(group.projects, project)) {
        addPreVersionCommand();
        writeJson(tree, 'nx.json', nxJson);
        output.log({
          title: `Project already included in existing release configuration for group ${name}`,
        });
        return;
      }
    }

    output.warn({
      title: `Could not find a release group that includes ${projectName}`,
      bodyLines: [
        `Ensure that ${projectName} is included in a release group's "projects" list in nx.json so it can be published with "nx release"`,
      ],
    });
    addPreVersionCommand();
    writeJson(tree, 'nx.json', nxJson);
    return;
  }

  if (typeof nxJson.release.projects === 'string') {
    nxJson.release.projects = [nxJson.release.projects, projectName];
    addPreVersionCommand();
    writeJson(tree, 'nx.json', nxJson);
    output.log({
      title: `Added project to existing release configuration`,
    });
    return;
  }
}

/**
 * Add release configuration for non-ts solution projects
 * Add release option in project.json and add packageRoot to nx-release-publish target
 */
export async function addReleaseConfigForNonTsSolution(
  useLegacyVersioning: boolean,
  tree: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration,
  defaultOutputDirectory: string = 'dist'
) {
  const packageRoot = joinPathFragments(
    defaultOutputDirectory,
    '{projectRoot}'
  );

  projectConfiguration.targets ??= {};
  projectConfiguration.targets['nx-release-publish'] = {
    options: {
      packageRoot,
    },
  };

  if (useLegacyVersioning) {
    projectConfiguration.release = {
      version: {
        generatorOptions: {
          packageRoot,
          // using git tags to determine the current version is required here because
          // the version in the package root is overridden with every build
          currentVersionResolver: 'git-tag',
          fallbackCurrentVersionResolver: 'disk',
        },
      },
    };
  } else {
    // TODO: re-evaluate this config in new versions
    projectConfiguration.release = {
      version: {
        manifestRootsToUpdate: [packageRoot],
        // using git tags to determine the current version is required here because
        // the version in the package root is overridden with every build
        currentVersionResolver: 'git-tag',
        fallbackCurrentVersionResolver: 'disk',
      },
    };
  }

  await addReleaseConfigForTsSolution(tree, projectName, projectConfiguration);

  return projectConfiguration;
}

function projectsConfigMatchesProject(
  projectsConfig: string | string[] | undefined,
  project: ProjectGraphProjectNode
): boolean {
  if (!projectsConfig) {
    return false;
  }

  if (typeof projectsConfig === 'string') {
    projectsConfig = [projectsConfig];
  }

  const graph: Record<string, ProjectGraphProjectNode> = {
    [project.name]: project,
  };

  const matchingProjects = findMatchingProjects(projectsConfig, graph);

  return matchingProjects.includes(project.name);
}

export async function releaseTasks(tree: Tree): Promise<GeneratorCallback> {
  return runTasksInSerial(
    await setupVerdaccio(tree, { skipFormat: true }),
    () => logNxReleaseDocsInfo()
  );
}

function logNxReleaseDocsInfo() {
  output.log({
    title: `📦 To learn how to publish this library, see https://nx.dev/core-features/manage-releases.`,
  });
}
