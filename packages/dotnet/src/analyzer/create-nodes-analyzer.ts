import { dirname, join, basename } from 'node:path';

import {
    CreateNodesContextV2,
    createNodesFromFiles,
    CreateNodesV2,
    logger,
    ProjectConfiguration,
    readJsonFile,
    writeJsonFile,
} from '@nx/devkit';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { hashArray, hashObject } from 'nx/src/hasher/file-hasher';

import {
    analyzeProjects,
    getProjectAnalysis,
    isTestProject,
    isExecutable,
    getProjectType,
    ProjectAnalysis,
} from './analyzer-client';

export interface DotNetPluginOptions {
    buildTargetName?: string;
    testTargetName?: string;
    cleanTargetName?: string;
    restoreTargetName?: string;
    publishTargetName?: string;
    packTargetName?: string;
}

interface NormalizedOptions {
    buildTargetName: string;
    testTargetName: string;
    cleanTargetName: string;
    restoreTargetName: string;
    publishTargetName: string;
    packTargetName: string;
}

type DotNetTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

const dotnetProjectGlob = '**/*.{csproj,fsproj,vbproj}';

export const createNodesV2Analyzer: CreateNodesV2<DotNetPluginOptions> = [
    dotnetProjectGlob,
    async (configFilePaths, options, context) => {
        const optionsHash = hashObject(options);
        const cachePath = join(
            workspaceDataDirectory,
            `dotnet-analyzer-${optionsHash}.hash`
        );
        const targetsCache = readTargetsCache(cachePath);
        const normalizedOptions = normalizeOptions(options);

        // Analyze all projects upfront
        try {
            analyzeProjects([...configFilePaths]);
        } catch (err) {
            const error = err as Error;
            logger.error(`Failed to run MSBuild analyzer: ${error.message}`);
            throw error;
        }

        // Group project files by their project root
        const projectRootToFiles = new Map<string, string[]>();
        for (const configFile of configFilePaths) {
            const projectRoot = dirname(configFile);
            if (!projectRootToFiles.has(projectRoot)) {
                projectRootToFiles.set(projectRoot, []);
            }
            projectRootToFiles.get(projectRoot)!.push(configFile);
        }

        const projectRoots = Array.from(projectRootToFiles.keys());

        // Calculate hash for each project root
        const hashes = projectRoots.map((projectRoot) => {
            const files = projectRootToFiles.get(projectRoot)!;
            return hashArray([projectRoot, ...files, optionsHash]);
        });

        try {
            return await createNodesFromFiles(
                (projectRoot, options, context, idx) =>
                    createNodesInternal(
                        projectRoot,
                        options,
                        context,
                        targetsCache,
                        projectRootToFiles.get(projectRoot)!,
                        hashes[idx]
                    ),
                projectRoots,
                options,
                context
            );
        } finally {
            writeTargetsToCache(cachePath, targetsCache);
        }
    },
];

function readTargetsCache(cachePath: string): Record<string, DotNetTargets> {
    try {
        return process.env.NX_CACHE_PROJECT_GRAPH !== 'false'
            ? readJsonFile(cachePath)
            : {};
    } catch {
        return {};
    }
}

function writeTargetsToCache(
    cachePath: string,
    results: Record<string, DotNetTargets>
) {
    writeJsonFile(cachePath, results);
}

async function createNodesInternal(
    projectRoot: string,
    options: DotNetPluginOptions,
    context: CreateNodesContextV2,
    targetsCache: Record<string, DotNetTargets>,
    projectFiles: string[],
    hash: string
) {
    const normalizedOptions = normalizeOptions(options);

    targetsCache[hash] ??= await buildDotNetTargets(
        projectRoot,
        projectFiles,
        normalizedOptions,
        context
    );
    const { targets, metadata } = targetsCache[hash];

    // For project naming, use the directory name when multiple projects,
    // or the single project file name when only one
    const projectName =
        projectFiles.length === 1
            ? inferProjectName(projectFiles[0])
            : basename(projectRoot)
                  .replace(/[^a-z0-9\-]/gi, '-')
                  .toLowerCase();

    return {
        projects: {
            [projectRoot]: {
                name: projectName,
                root: projectRoot,
                targets,
                metadata,
            },
        },
    };
}

function normalizeOptions(options: DotNetPluginOptions): NormalizedOptions {
    return {
        buildTargetName: options?.buildTargetName ?? 'build',
        testTargetName: options?.testTargetName ?? 'test',
        cleanTargetName: options?.cleanTargetName ?? 'clean',
        restoreTargetName: options?.restoreTargetName ?? 'restore',
        publishTargetName: options?.publishTargetName ?? 'publish',
        packTargetName: options?.packTargetName ?? 'pack',
    };
}

function inferProjectName(configFilePath: string): string {
    const filename =
        basename(configFilePath, '.csproj') ||
        basename(configFilePath, '.fsproj') ||
        basename(configFilePath, '.vbproj');

    // Convert PascalCase to kebab-case for regular project names
    return filename
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase()
        .replace(/[^a-z0-9\-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function extractProjectNameFromFile(projectFileName: string): string {
    const nameWithoutExtension =
        basename(projectFileName, '.csproj') ||
        basename(projectFileName, '.fsproj') ||
        basename(projectFileName, '.vbproj');

    // Convert PascalCase to kebab-case for target names
    return nameWithoutExtension
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase()
        .replace(/[^a-z0-9\-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

interface ProjectInfo {
    fileName: string;
    projectName: string;
    analysis: ProjectAnalysis;
    isTest: boolean;
    isExe: boolean;
    projectType: 'csharp' | 'fsharp' | 'vb';
}

function getProjectInfoFromAnalysis(projectFile: string): ProjectInfo {
    const analysis = getProjectAnalysis(projectFile);

    if (!analysis) {
        throw new Error(
            `No analysis result found for ${projectFile}. This is a bug.`
        );
    }

    return {
        fileName: basename(projectFile),
        projectName: extractProjectNameFromFile(basename(projectFile)),
        analysis,
        isTest: isTestProject(analysis),
        isExe: isExecutable(analysis),
        projectType: getProjectType(projectFile),
    };
}

async function buildDotNetTargets(
    projectRoot: string,
    projectFiles: string[],
    options: NormalizedOptions,
    context: CreateNodesContextV2
): Promise<DotNetTargets> {
    const namedInputs = getNamedInputs(projectRoot, context);
    const targets: ProjectConfiguration['targets'] = {};
    let metadata: ProjectConfiguration['metadata'];

    const hasMultipleProjects = projectFiles.length > 1;

    // Collect information about all projects using analyzer results
    const projectInfos = projectFiles.map((projectFile) =>
        getProjectInfoFromAnalysis(projectFile)
    );

    // Aggregate technology detection from all projects
    const technologies = new Set(['dotnet']);
    let hasTestProjects = false;
    let hasExecutableProjects = false;
    let hasLibraryProjects = false;

    for (const info of projectInfos) {
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

        if (info.isTest) {
            technologies.add('test');
            hasTestProjects = true;
        }

        if (info.isExe) {
            hasExecutableProjects = true;
        }

        if (!info.isExe && !info.isTest) {
            hasLibraryProjects = true;
        }
    }

    const technologiesArray = Array.from(technologies);
    metadata = { technologies: technologiesArray };

    const baseInputs =
        'production' in namedInputs
            ? ['default', '^production']
            : ['default', '^default'];

    // Build target - always available
    if (hasMultipleProjects) {
        for (const { fileName, projectName } of projectInfos) {
            const projectSpecificBuildTarget = `${options.buildTargetName}:${projectName}`;
            targets[projectSpecificBuildTarget] = {
                command: 'dotnet build',
                options: {
                    cwd: '{projectRoot}',
                    args: [fileName, '--no-restore', '--no-dependencies'],
                },
                dependsOn: [
                    `${options.restoreTargetName}:${projectName}`,
                    '^build',
                ],
                cache: true,
                inputs: baseInputs,
                outputs: [
                    '{projectRoot}/bin',
                    '{projectRoot}/obj',
                    '{workspaceRoot}/artifacts/bin/{projectName}',
                    '{workspaceRoot}/artifacts/obj/{projectName}',
                ],
                metadata: {
                    technologies: technologiesArray,
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

        targets[options.buildTargetName] = {
            dependsOn: [`${options.buildTargetName}:*`],
            cache: false,
            metadata: {
                technologies: technologiesArray,
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
                technologies: technologiesArray,
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

    // Test target - only for test projects
    if (hasTestProjects) {
        if (hasMultipleProjects) {
            for (const { fileName, projectName, isTest, analysis } of projectInfos) {
                if (isTest) {
                    const projectSpecificTestTarget = `${options.testTargetName}:${projectName}`;
                    const packageNames = analysis.packageReferences.map(
                        (pkg) => pkg.Include
                    );
                    targets[projectSpecificTestTarget] = {
                        command: 'dotnet test',
                        options: {
                            cwd: '{projectRoot}',
                            args: [fileName, '--no-dependencies', '--no-build'],
                        },
                        dependsOn: [
                            `${options.buildTargetName}:${projectName}`,
                        ],
                        cache: true,
                        inputs: [
                            ...baseInputs,
                            { externalDependencies: packageNames },
                        ],
                        outputs: ['{projectRoot}/TestResults'],
                        metadata: {
                            technologies: technologiesArray,
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

            targets[options.testTargetName] = {
                dependsOn: [`${options.testTargetName}:*`],
                cache: false,
                metadata: {
                    technologies: technologiesArray,
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
            const { analysis } = projectInfos[0];
            const packageNames = analysis.packageReferences.map(
                (pkg) => pkg.Include
            );
            targets[options.testTargetName] = {
                command: 'dotnet test',
                options: {
                    cwd: '{projectRoot}',
                    args: ['--no-dependencies', '--no-build'],
                },
                dependsOn: [options.buildTargetName],
                cache: true,
                inputs: [
                    ...baseInputs,
                    { externalDependencies: packageNames },
                ],
                outputs: ['{projectRoot}/TestResults'],
                metadata: {
                    technologies: technologiesArray,
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

    // Restore target - always available
    if (hasMultipleProjects) {
        for (const { fileName, projectName } of projectInfos) {
            const projectSpecificRestoreTarget = `${options.restoreTargetName}:${projectName}`;
            targets[projectSpecificRestoreTarget] = {
                command: 'dotnet restore',
                options: {
                    cwd: '{projectRoot}',
                    args: [fileName, '--no-dependencies'],
                },
                dependsOn: [`^${options.restoreTargetName}`],
                cache: true,
                inputs: ['{projectRoot}/' + fileName],
                outputs: ['{projectRoot}/obj'],
                metadata: {
                    technologies: technologiesArray,
                    description: `Restore dependencies for ${fileName}`,
                    help: {
                        command: 'dotnet restore --help',
                        example: {
                            options: {},
                        },
                    },
                },
            };
        }

        targets[options.restoreTargetName] = {
            dependsOn: [`${options.restoreTargetName}:*`],
            cache: false,
            metadata: {
                technologies: technologiesArray,
                description:
                    'Restore dependencies for all .NET projects in this directory',
                help: {
                    command: 'dotnet restore --help',
                    example: {
                        options: {},
                    },
                },
            },
        };
    } else {
        targets[options.restoreTargetName] = {
            command: 'dotnet restore',
            options: {
                cwd: '{projectRoot}',
                args: ['--no-dependencies'],
            },
            dependsOn: [`^${options.restoreTargetName}`],
            cache: true,
            inputs: [
                '{projectRoot}/*.csproj',
                '{projectRoot}/*.fsproj',
                '{projectRoot}/*.vbproj',
            ],
            outputs: ['{projectRoot}/obj'],
            metadata: {
                technologies: technologiesArray,
                description: 'Restore .NET project dependencies',
                help: {
                    command: 'dotnet restore --help',
                    example: {
                        options: {},
                    },
                },
            },
        };
    }

    // Clean target - always available
    if (hasMultipleProjects) {
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
                    technologies: technologiesArray,
                    description: `Clean build artifacts for ${fileName}`,
                    help: {
                        command: 'dotnet clean --help',
                        example: {
                            options: {},
                        },
                    },
                },
            };
        }

        targets[options.cleanTargetName] = {
            dependsOn: [`${options.cleanTargetName}:*`],
            cache: false,
            metadata: {
                technologies: technologiesArray,
                description:
                    'Clean build artifacts for all .NET projects in this directory',
                help: {
                    command: 'dotnet clean --help',
                    example: {
                        options: {},
                    },
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
                technologies: technologiesArray,
                description: 'Clean build artifacts',
                help: {
                    command: 'dotnet clean --help',
                    example: {
                        options: {},
                    },
                },
            },
        };
    }

    // Publish target - for executable projects
    if (hasExecutableProjects) {
        if (hasMultipleProjects) {
            for (const { fileName, projectName, isExe } of projectInfos) {
                if (isExe) {
                    const projectSpecificPublishTarget = `${options.publishTargetName}:${projectName}`;
                    targets[projectSpecificPublishTarget] = {
                        command: 'dotnet publish',
                        options: {
                            cwd: '{projectRoot}',
                            args: [fileName, '--no-build', '--no-dependencies'],
                        },
                        dependsOn: [
                            `${options.buildTargetName}:${projectName}`,
                        ],
                        cache: true,
                        inputs: baseInputs,
                        outputs: ['{projectRoot}/bin/Release/publish'],
                        metadata: {
                            technologies: technologiesArray,
                            description: `Publish the ${fileName} application`,
                            help: {
                                command: 'dotnet publish --help',
                                example: {
                                    options: {
                                        configuration: 'Release',
                                        output: './publish',
                                    },
                                },
                            },
                        },
                    };
                }
            }

            targets[options.publishTargetName] = {
                dependsOn: [`${options.publishTargetName}:*`],
                cache: false,
                metadata: {
                    technologies: technologiesArray,
                    description:
                        'Publish all executable .NET applications in this directory',
                    help: {
                        command: 'dotnet publish --help',
                        example: {
                            options: {
                                configuration: 'Release',
                                output: './publish',
                            },
                        },
                    },
                },
            };
        } else {
            const { isExe } = projectInfos[0];
            if (isExe) {
                targets[options.publishTargetName] = {
                    command: 'dotnet publish',
                    options: {
                        cwd: '{projectRoot}',
                        args: ['--no-build', '--no-dependencies'],
                    },
                    dependsOn: [options.buildTargetName],
                    cache: true,
                    inputs: baseInputs,
                    outputs: ['{projectRoot}/bin/Release/publish'],
                    metadata: {
                        technologies: technologiesArray,
                        description: 'Publish the .NET application',
                        help: {
                            command: 'dotnet publish --help',
                            example: {
                                options: {
                                    configuration: 'Release',
                                    output: './publish',
                                },
                            },
                        },
                    },
                };
            }
        }
    }

    // Pack target - for library projects (non-executable, non-test)
    if (hasLibraryProjects) {
        if (hasMultipleProjects) {
            for (const { fileName, projectName, isExe, isTest } of projectInfos) {
                if (!isExe && !isTest) {
                    const projectSpecificPackTarget = `${options.packTargetName}:${projectName}`;
                    targets[projectSpecificPackTarget] = {
                        command: 'dotnet pack',
                        options: {
                            cwd: '{projectRoot}',
                            args: [fileName, '--no-dependencies', '--no-build'],
                        },
                        dependsOn: [
                            `${options.buildTargetName}:${projectName}`,
                        ],
                        cache: true,
                        inputs: baseInputs,
                        outputs: ['{projectRoot}/bin/Release/*.nupkg'],
                        metadata: {
                            technologies: technologiesArray,
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

            targets[options.packTargetName] = {
                dependsOn: [`${options.packTargetName}:*`],
                cache: false,
                metadata: {
                    technologies: technologiesArray,
                    description:
                        'Create NuGet packages for all library projects in this directory',
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
            const { isExe, isTest } = projectInfos[0];
            if (!isExe && !isTest) {
                targets[options.packTargetName] = {
                    command: 'dotnet pack',
                    options: {
                        cwd: '{projectRoot}',
                        args: ['--no-dependencies', '--no-build'],
                    },
                    dependsOn: [options.buildTargetName],
                    cache: true,
                    inputs: baseInputs,
                    outputs: ['{projectRoot}/bin/Release/*.nupkg'],
                    metadata: {
                        technologies: technologiesArray,
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
    }

    return { targets, metadata };
}
