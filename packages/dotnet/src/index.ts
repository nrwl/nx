import { readFileSync } from 'node:fs';
import { dirname, join, basename, resolve, relative, parse } from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

import {
    CreateNodesContext,
    createNodesFromFiles,
    CreateNodesV2,
    CreateDependencies,
    DependencyType,
    logger,
    normalizePath,
    ProjectConfiguration,
    RawProjectGraphDependency,
    readJsonFile,
    writeJsonFile,
} from '@nx/devkit';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { calculateHashesForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { hashObject } from 'nx/src/hasher/file-hasher';

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

export const createNodesV2: CreateNodesV2<DotNetPluginOptions> = [
    dotnetProjectGlob,
    async (configFilePaths, options, context) => {
        const optionsHash = hashObject(options);
        const cachePath = join(
            workspaceDataDirectory,
            `dotnet-${optionsHash}.hash`
        );
        const targetsCache = readTargetsCache(cachePath);
        const normalizedOptions = normalizeOptions(options);

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

        // Calculate all hashes at once
        const hashes = await calculateHashesForCreateNodes(
            projectRoots,
            normalizedOptions,
            context
        );

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
    context: CreateNodesContext,
    targetsCache: Record<string, DotNetTargets>,
    projectFiles: string[],
    hash: string
) {
    // For .NET projects, we don't require package.json or project.json
    // The .csproj/.fsproj/.vbproj file itself indicates a valid project

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
    const projectRoot = dirname(configFilePath);
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
    targetFramework?: string;
    outputType?: string;
    packageReferences: string[];
    projectReferences: string[];
    isTestProject: boolean;
    isExecutable: boolean;
    projectType: 'csharp' | 'fsharp' | 'vb';
}

function parseProjectFile(projectFilePath: string): ProjectInfo {
    const content = readFileSync(projectFilePath, 'utf-8');
    const packageReferences: string[] = [];
    const projectReferences: string[] = [];

    // Simple regex parsing for MSBuild project files
    const packageReferenceRegex = /<PackageReference\s+Include="([^"]+)"/g;
    const projectReferenceRegex = /<ProjectReference\s+Include="([^"]+)"/g;
    const targetFrameworkRegex = /<TargetFramework>([^<]+)<\/TargetFramework>/;
    const outputTypeRegex = /<OutputType>([^<]+)<\/OutputType>/;

    let match: RegExpExecArray | null;
    while ((match = packageReferenceRegex.exec(content)) !== null) {
        packageReferences.push(match[1]);
    }

    while ((match = projectReferenceRegex.exec(content)) !== null) {
        projectReferences.push(match[1]);
    }

    const targetFrameworkMatch = content.match(targetFrameworkRegex);
    const outputTypeMatch = content.match(outputTypeRegex);

    const targetFramework = targetFrameworkMatch?.[1];
    const outputType = outputTypeMatch?.[1];

    // Detect test projects by common test package references
    const testPackages = [
        'Microsoft.NET.Test.Sdk',
        'xunit',
        'xunit.runner.visualstudio',
        'MSTest.TestAdapter',
        'MSTest.TestFramework',
        'NUnit',
        'NUnit3TestAdapter',
    ];
    const isTestProject = packageReferences.some((pkg) =>
        testPackages.some((testPkg) => pkg.includes(testPkg))
    );

    const isExecutable =
        outputType?.toLowerCase() === 'exe' ||
        content.includes('<OutputType>Exe</OutputType>');

    // Determine project type from file extension
    const extension = projectFilePath.split('.').pop()?.toLowerCase();
    let projectType: 'csharp' | 'fsharp' | 'vb';
    switch (extension) {
        case 'fsproj':
            projectType = 'fsharp';
            break;
        case 'vbproj':
            projectType = 'vb';
            break;
        default:
            projectType = 'csharp';
    }

    return {
        targetFramework,
        outputType,
        packageReferences,
        projectReferences,
        isTestProject,
        isExecutable,
        projectType,
    };
}

async function buildDotNetTargets(
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
    const projectInfos = projectFiles.map((projectFile) => ({
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

    // Build target - always available
    if (hasMultipleProjects) {
        // Create project-specific build targets for each project
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

        // Create umbrella build target that depends on all project-specific build targets
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
        // Single project - use original logic
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
                        dependsOn: [
                            `${options.buildTargetName}:${projectName}`,
                        ],
                        cache: true,
                        inputs: [
                            ...baseInputs,
                            { externalDependencies: info.packageReferences },
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

            // Create umbrella test target
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
            // Single project - use original logic
            const { info } = projectInfos[0];
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
                    { externalDependencies: info.packageReferences },
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
        // Create project-specific restore targets for each project
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

        // Create umbrella restore target
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
        // Single project - use original logic
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
        // Create project-specific clean targets for each project
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

        // Create umbrella clean target
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
        // Single project - use original logic
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
            // Create project-specific publish targets for each executable project
            for (const { fileName, projectName, info } of projectInfos) {
                if (info.isExecutable) {
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

            // Create umbrella publish target
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
            // Single project - use original logic
            const { info } = projectInfos[0];
            if (info.isExecutable) {
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
            // Create project-specific pack targets for each library project
            for (const { fileName, projectName, info } of projectInfos) {
                if (!info.isExecutable && !info.isTestProject) {
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

            // Create umbrella pack target
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
            // Single project - use original logic
            const { info } = projectInfos[0];
            if (!info.isExecutable && !info.isTestProject) {
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

// Dependency Detection Implementation

interface DotNetClient {
    getProjectReferencesAsync(projectFile: string): Promise<string[]>;
}

class NativeDotNetClient implements DotNetClient {
    constructor(private workspaceRoot: string) {}

    async getProjectReferencesAsync(projectFile: string): Promise<string[]> {
        const output = execSync(`dotnet list "${projectFile}" reference`, {
            cwd: this.workspaceRoot,
            encoding: 'utf8',
            windowsHide: true,
        });

        return output
            .split('\n')
            .slice(2) // Skip header lines
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    }
}

function createProjectRootMappings(
    projects: Record<string, ProjectConfiguration>
): Record<string, string> {
    const rootMap: Record<string, string> = {};
    for (const [, project] of Object.entries(projects)) {
        if (project.root && project.name) {
            rootMap[project.root] = project.name;
        }
    }
    return rootMap;
}

function findProjectForPath(
    filePath: string,
    rootMap: Record<string, string>
): string | undefined {
    let currentPath = normalizePath(filePath);

    for (
        ;
        currentPath !== dirname(currentPath);
        currentPath = dirname(currentPath)
    ) {
        const project = rootMap[currentPath];
        if (project) {
            return project;
        }
    }

    return rootMap[currentPath];
}

function resolveReferenceToProject(
    reference: string,
    sourceFile: string,
    rootMap: Record<string, string>,
    workspaceRoot: string
): string | undefined {
    const resolved = resolve(workspaceRoot, dirname(sourceFile), reference);
    const relativePath = relative(workspaceRoot, resolved);
    return findProjectForPath(relativePath, rootMap);
}

export const createDependencies: CreateDependencies<
    DotNetPluginOptions
> = async (_, ctx) => {
    const dependencies: RawProjectGraphDependency[] = [];

    const rootMap = createProjectRootMappings(ctx.projects);

    // Use dotnet CLI for dependency detection
    const dotnetClient = new NativeDotNetClient(ctx.workspaceRoot);

    for (const [source] of Object.entries(ctx.projects)) {
        const files = ctx.filesToProcess.projectFileMap[source] || [];

        for (const file of files) {
            const { ext } = parse(file.file);
            if (['.csproj', '.fsproj', '.vbproj'].includes(ext)) {
                const references = await dotnetClient.getProjectReferencesAsync(
                    join(ctx.workspaceRoot, file.file)
                );

                for (const reference of references) {
                    const target = resolveReferenceToProject(
                        reference,
                        file.file,
                        rootMap,
                        ctx.workspaceRoot
                    );
                    if (target) {
                        dependencies.push({
                            source,
                            target,
                            type: DependencyType.static,
                            sourceFile: file.file,
                        });
                    }
                }
            }
        }
    }

    return dependencies;
};
