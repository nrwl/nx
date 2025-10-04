import { join, basename } from 'node:path';
import {
  CreateNodesContext,
  ProjectConfiguration,
  TargetConfiguration,
} from '@nx/devkit';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import {
  parseProjectFile,
  extractProjectNameFromFile,
  ProjectInfo,
} from './dotnet-project-parser';
import { DotNetTargets } from './cache';

export interface NormalizedOptions {
  buildTargetName: string;
  testTargetName: string;
  cleanTargetName: string;
  restoreTargetName: string;
  publishTargetName: string;
  packTargetName: string;
}

interface ProjectFileInfo {
  file: string;
  fileName: string;
  projectName: string;
  info: ProjectInfo;
}

export async function buildDotNetTargets(
  projectRoot: string,
  projectFiles: string[],
  options: NormalizedOptions,
  context: CreateNodesContext
): Promise<DotNetTargets> {
  const namedInputs = getNamedInputs(projectRoot, context);
  const targets: ProjectConfiguration['targets'] = {};
  let metadata: ProjectConfiguration['metadata'];

  const hasMultipleProjects = projectFiles.length > 1;

  // Collect information about all projects in this directory
  const projectInfos: ProjectFileInfo[] = projectFiles.map((projectFile) => ({
    file: projectFile,
    fileName: basename(projectFile),
    projectName: extractProjectNameFromFile(basename(projectFile)),
    info: parseProjectFile(join(context.workspaceRoot, projectFile)),
  }));

  // Aggregate technology detection from all projects
  const technologies = new Set(['dotnet']);
  let hasTestProjects = false;
  let hasExecutableProjects = false;
  let hasLibraryProjects = false;

  for (const { info } of projectInfos) {
    switch (info.projectType) {
      case 'csharp':
        technologies.add('csharp');
        break;
      case 'fsharp':
        technologies.add('fsharp');
        break;
      case 'vb':
        technologies.add('vb');
        break;
    }

    if (info.isTestProject) {
      technologies.add('test');
      hasTestProjects = true;
    }

    if (info.isExecutable) {
      hasExecutableProjects = true;
    }

    if (!info.isExecutable && !info.isTestProject) {
      hasLibraryProjects = true;
    }
  }

  const technologiesArray = Array.from(technologies);
  metadata = { technologies: technologiesArray };

  const baseInputs =
    'production' in namedInputs
      ? ['default', '^production']
      : ['default', '^default'];

  // Build restore targets
  addRestoreTargets(
    targets,
    projectInfos,
    options,
    hasMultipleProjects,
    technologiesArray
  );

  // Build targets
  addBuildTargets(
    targets,
    projectInfos,
    options,
    hasMultipleProjects,
    baseInputs,
    technologiesArray
  );

  // Test targets
  if (hasTestProjects) {
    addTestTargets(
      targets,
      projectInfos,
      options,
      hasMultipleProjects,
      baseInputs,
      technologiesArray
    );
  }

  // Clean targets
  addCleanTargets(
    targets,
    projectInfos,
    options,
    hasMultipleProjects,
    technologiesArray
  );

  // Publish targets
  if (hasExecutableProjects) {
    addPublishTargets(
      targets,
      projectInfos,
      options,
      hasMultipleProjects,
      baseInputs,
      technologiesArray
    );
  }

  // Pack targets
  if (hasLibraryProjects) {
    addPackTargets(
      targets,
      projectInfos,
      options,
      hasMultipleProjects,
      baseInputs,
      technologiesArray
    );
  }

  return { targets, metadata };
}

function addRestoreTargets(
  targets: ProjectConfiguration['targets'],
  projectInfos: ProjectFileInfo[],
  options: NormalizedOptions,
  hasMultipleProjects: boolean,
  technologies: string[]
) {
  if (hasMultipleProjects) {
    // Create project-specific restore targets
    for (const { fileName, projectName, info } of projectInfos) {
      const projectSpecificRestoreTarget = `${options.restoreTargetName}:${projectName}`;
      targets[projectSpecificRestoreTarget] = {
        command: 'dotnet restore',
        options: {
          cwd: '{projectRoot}',
          args: [fileName],
        },
        cache: true,
        inputs: [
          '{projectRoot}/**/*.{cs,csproj,fs,fsproj,vb,vbproj}',
          // @todo(@AgentEnder): we should include these, but right now we aren't adding them to graph.
          // { externalDependencies: info.packageReferences },
        ],
        outputs: ['{projectRoot}/obj'],
        metadata: {
          technologies,
          description: `Restore dependencies for ${fileName}`,
          help: {
            command: 'dotnet restore --help',
            example: {},
          },
        },
      };
    }

    // Create umbrella restore target
    targets[options.restoreTargetName] = {
      dependsOn: [`${options.restoreTargetName}:*`],
      cache: false,
      metadata: {
        technologies,
        description: 'Restore all .NET projects in this directory',
        help: {
          command: 'dotnet restore --help',
          example: {},
        },
      },
    };
  } else {
    const { info } = projectInfos[0];
    targets[options.restoreTargetName] = {
      command: 'dotnet restore',
      options: {
        cwd: '{projectRoot}',
      },
      cache: true,
      inputs: [
        '{projectRoot}/**/*.{cs,csproj,fs,fsproj,vb,vbproj}',
        // { externalDependencies: info.packageReferences },
      ],
      outputs: ['{projectRoot}/obj'],
      metadata: {
        technologies,
        description: 'Restore .NET dependencies',
        help: {
          command: 'dotnet restore --help',
          example: {},
        },
      },
    };
  }
}

function addBuildTargets(
  targets: ProjectConfiguration['targets'],
  projectInfos: ProjectFileInfo[],
  options: NormalizedOptions,
  hasMultipleProjects: boolean,
  baseInputs: string[],
  technologies: string[]
) {
  if (hasMultipleProjects) {
    // Create project-specific build targets
    for (const { fileName, projectName } of projectInfos) {
      const projectSpecificBuildTarget = `${options.buildTargetName}:${projectName}`;
      targets[projectSpecificBuildTarget] = {
        command: 'dotnet build',
        options: {
          cwd: '{projectRoot}',
          args: [fileName, '--no-restore', '--no-dependencies'],
        },
        dependsOn: [`${options.restoreTargetName}:${projectName}`, '^build'],
        cache: true,
        inputs: baseInputs,
        outputs: [
          '{projectRoot}/bin',
          '{projectRoot}/obj',
          '{workspaceRoot}/artifacts/bin/{projectName}',
          '{workspaceRoot}/artifacts/obj/{projectName}',
        ],
        metadata: {
          technologies,
          description: `Build the ${fileName} project`,
          help: {
            command: 'dotnet build --help',
            example: {
              options: {
                configuration: 'Release',
              },
            },
          },
        },
      };
    }

    // Create umbrella build target
    targets[options.buildTargetName] = {
      dependsOn: [`${options.buildTargetName}:*`],
      cache: false,
      metadata: {
        technologies,
        description: 'Build all .NET projects in this directory',
        help: {
          command: 'dotnet build --help',
          example: {
            options: {
              configuration: 'Release',
            },
          },
        },
      },
    };
  } else {
    targets[options.buildTargetName] = {
      command: 'dotnet build',
      options: {
        cwd: '{projectRoot}',
        args: ['--no-restore', '--no-dependencies'],
      },
      dependsOn: [options.restoreTargetName, '^build'],
      cache: true,
      inputs: baseInputs,
      outputs: ['{projectRoot}/bin', '{projectRoot}/obj'],
      metadata: {
        technologies,
        description: 'Build the .NET project',
        help: {
          command: 'dotnet build --help',
          example: {
            options: {
              configuration: 'Release',
            },
          },
        },
      },
    };
  }
}

function addTestTargets(
  targets: ProjectConfiguration['targets'],
  projectInfos: ProjectFileInfo[],
  options: NormalizedOptions,
  hasMultipleProjects: boolean,
  baseInputs: string[],
  technologies: string[]
) {
  if (hasMultipleProjects) {
    // Create project-specific test targets for each test project
    for (const { fileName, projectName, info } of projectInfos) {
      if (info.isTestProject) {
        const projectSpecificTestTarget = `${options.testTargetName}:${projectName}`;
        targets[projectSpecificTestTarget] = {
          command: 'dotnet test',
          options: {
            cwd: '{projectRoot}',
            args: [fileName, '--no-dependencies', '--no-build'],
          },
          dependsOn: [`${options.buildTargetName}:${projectName}`],
          cache: true,
          inputs: [
            ...baseInputs,
            // { externalDependencies: info.packageReferences },
          ],
          outputs: ['{projectRoot}/TestResults'],
          metadata: {
            technologies,
            description: `Run tests for ${fileName}`,
            help: {
              command: 'dotnet test --help',
              example: {
                options: {
                  logger: 'trx',
                },
              },
            },
          },
        };
      }
    }

    // Create umbrella test target
    targets[options.testTargetName] = {
      dependsOn: [`${options.testTargetName}:*`],
      cache: false,
      metadata: {
        technologies,
        description: 'Run all .NET tests in this directory',
        help: {
          command: 'dotnet test --help',
          example: {
            options: {
              logger: 'trx',
            },
          },
        },
      },
    };
  } else {
    const { info } = projectInfos[0];
    targets[options.testTargetName] = {
      command: 'dotnet test',
      options: {
        cwd: '{projectRoot}',
        args: ['--no-build'],
      },
      dependsOn: [options.buildTargetName],
      cache: true,
      inputs: [
        ...baseInputs,
        //  { externalDependencies: info.packageReferences }
      ],
      outputs: ['{projectRoot}/TestResults'],
      metadata: {
        technologies,
        description: 'Run .NET tests',
        help: {
          command: 'dotnet test --help',
          example: {
            options: {
              logger: 'trx',
            },
          },
        },
      },
    };
  }
}

function addCleanTargets(
  targets: ProjectConfiguration['targets'],
  projectInfos: ProjectFileInfo[],
  options: NormalizedOptions,
  hasMultipleProjects: boolean,
  technologies: string[]
) {
  if (hasMultipleProjects) {
    // Create project-specific clean targets
    for (const { fileName, projectName } of projectInfos) {
      const projectSpecificCleanTarget = `${options.cleanTargetName}:${projectName}`;
      targets[projectSpecificCleanTarget] = {
        command: 'dotnet clean',
        options: {
          cwd: '{projectRoot}',
          args: [fileName],
        },
        cache: false,
        metadata: {
          technologies,
          description: `Clean ${fileName} build outputs`,
          help: {
            command: 'dotnet clean --help',
            example: {},
          },
        },
      };
    }

    // Create umbrella clean target
    targets[options.cleanTargetName] = {
      dependsOn: [`${options.cleanTargetName}:*`],
      cache: false,
      metadata: {
        technologies,
        description: 'Clean all .NET projects in this directory',
        help: {
          command: 'dotnet clean --help',
          example: {},
        },
      },
    };
  } else {
    targets[options.cleanTargetName] = {
      command: 'dotnet clean',
      options: {
        cwd: '{projectRoot}',
      },
      cache: false,
      metadata: {
        technologies,
        description: 'Clean .NET build outputs',
        help: {
          command: 'dotnet clean --help',
          example: {},
        },
      },
    };
  }
}

function addPublishTargets(
  targets: ProjectConfiguration['targets'],
  projectInfos: ProjectFileInfo[],
  options: NormalizedOptions,
  hasMultipleProjects: boolean,
  baseInputs: string[],
  technologies: string[]
) {
  if (hasMultipleProjects) {
    // Create project-specific publish targets for executable projects
    for (const { fileName, projectName, info } of projectInfos) {
      if (info.isExecutable) {
        const projectSpecificPublishTarget = `${options.publishTargetName}:${projectName}`;
        targets[projectSpecificPublishTarget] = {
          command: 'dotnet publish',
          options: {
            cwd: '{projectRoot}',
            args: [fileName, '--no-dependencies'],
          },
          dependsOn: [`${options.buildTargetName}:${projectName}`],
          cache: true,
          inputs: baseInputs,
          outputs: ['{projectRoot}/bin/*/publish'],
          metadata: {
            technologies,
            description: `Publish ${fileName} for deployment`,
            help: {
              command: 'dotnet publish --help',
              example: {
                options: {
                  configuration: 'Release',
                  runtime: 'win-x64',
                },
              },
            },
          },
        };
      }
    }

    // Create umbrella publish target
    targets[options.publishTargetName] = {
      dependsOn: [`${options.publishTargetName}:*`],
      cache: false,
      metadata: {
        technologies,
        description: 'Publish all executable .NET projects',
        help: {
          command: 'dotnet publish --help',
          example: {
            options: {
              configuration: 'Release',
              runtime: 'win-x64',
            },
          },
        },
      },
    };
  } else {
    targets[options.publishTargetName] = {
      command: 'dotnet publish',
      options: {
        cwd: '{projectRoot}',
        args: ['--no-dependencies'],
      },
      dependsOn: [options.buildTargetName],
      cache: true,
      inputs: baseInputs,
      outputs: ['{projectRoot}/bin/*/publish'],
      metadata: {
        technologies,
        description: 'Publish .NET executable for deployment',
        help: {
          command: 'dotnet publish --help',
          example: {
            options: {
              configuration: 'Release',
              runtime: 'win-x64',
            },
          },
        },
      },
    };
  }
}

function addPackTargets(
  targets: ProjectConfiguration['targets'],
  projectInfos: ProjectFileInfo[],
  options: NormalizedOptions,
  hasMultipleProjects: boolean,
  baseInputs: string[],
  technologies: string[]
) {
  if (hasMultipleProjects) {
    // Create project-specific pack targets for library projects
    for (const { fileName, projectName, info } of projectInfos) {
      if (!info.isExecutable && !info.isTestProject) {
        const projectSpecificPackTarget = `${options.packTargetName}:${projectName}`;
        targets[projectSpecificPackTarget] = {
          command: 'dotnet pack',
          options: {
            cwd: '{projectRoot}',
            args: [fileName, '--no-dependencies'],
          },
          dependsOn: [`${options.buildTargetName}:${projectName}`],
          cache: true,
          inputs: baseInputs,
          outputs: ['{projectRoot}/bin/*/*.nupkg'],
          metadata: {
            technologies,
            description: `Create NuGet package for ${fileName}`,
            help: {
              command: 'dotnet pack --help',
              example: {
                options: {
                  configuration: 'Release',
                },
              },
            },
          },
        };
      }
    }

    // Create umbrella pack target
    targets[options.packTargetName] = {
      dependsOn: [`${options.packTargetName}:*`],
      cache: false,
      metadata: {
        technologies,
        description: 'Pack all .NET library projects',
        help: {
          command: 'dotnet pack --help',
          example: {
            options: {
              configuration: 'Release',
            },
          },
        },
      },
    };
  } else {
    targets[options.packTargetName] = {
      command: 'dotnet pack',
      options: {
        cwd: '{projectRoot}',
        args: ['--no-dependencies'],
      },
      dependsOn: [options.buildTargetName],
      cache: true,
      inputs: baseInputs,
      outputs: ['{projectRoot}/bin/*/*.nupkg'],
      metadata: {
        technologies,
        description: 'Create NuGet package',
        help: {
          command: 'dotnet pack --help',
          example: {
            options: {
              configuration: 'Release',
            },
          },
        },
      },
    };
  }
}
