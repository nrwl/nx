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

        // Collect all project roots
        const projectRoots = configFilePaths.map((configFile) =>
            dirname(configFile)
        );

        // Calculate all hashes at once
        const hashes = await calculateHashesForCreateNodes(
            projectRoots,
            normalizedOptions,
            context
        );

        try {
            return await createNodesFromFiles(
                (configFile, options, context, idx) =>
                    createNodesInternal(
                        configFile,
                        options,
                        context,
                        targetsCache,
                        projectRoots[idx],
                        hashes[idx]
                    ),
                configFilePaths,
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
    configFilePath: string,
    options: DotNetPluginOptions,
    context: CreateNodesContext,
    targetsCache: Record<string, DotNetTargets>,
    projectRoot: string,
    hash: string
) {
    // For .NET projects, we don't require package.json or project.json
    // The .csproj/.fsproj/.vbproj file itself indicates a valid project

    const normalizedOptions = normalizeOptions(options);

    targetsCache[hash] ??= await buildDotNetTargets(
        configFilePath,
        projectRoot,
        normalizedOptions,
        context
    );
    const { targets, metadata } = targetsCache[hash];

    const projectName = inferProjectName(configFilePath);

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
    configFilePath: string,
    projectRoot: string,
    options: NormalizedOptions,
    context: CreateNodesContext
): Promise<DotNetTargets> {
    const projectInfo = parseProjectFile(
        join(context.workspaceRoot, configFilePath)
    );
    const namedInputs = getNamedInputs(projectRoot, context);

    const targets: ProjectConfiguration['targets'] = {};
    let metadata: ProjectConfiguration['metadata'];

    // Technology detection based on project type
    const technologies = ['dotnet'];
    switch (projectInfo.projectType) {
        case 'csharp':
            technologies.push('csharp');
            break;
        case 'fsharp':
            technologies.push('fsharp');
            break;
        case 'vb':
            technologies.push('vb');
            break;
    }

    if (projectInfo.isTestProject) {
        technologies.push('test');
    }

    const baseInputs =
        'production' in namedInputs
            ? ['default', '^production']
            : ['default', '^default'];

    // Build target - always available
    targets[options.buildTargetName] = {
        command: 'dotnet build',
        options: {
            cwd: '{projectRoot}',
            args: ['--no-restore', '--no-dependencies'],
        },
        dependsOn: ['restore', '^build'],
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

    // Test target - only for test projects
    if (projectInfo.isTestProject) {
        targets[options.testTargetName] = {
            command: 'dotnet test',
            options: {
                cwd: '{projectRoot}',
                args: ['--no-dependencies', '--no-build'],
            },
            dependsOn: ['build'],
            cache: true,
            inputs: [
                ...baseInputs,
                { externalDependencies: projectInfo.packageReferences },
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

    // Restore target - always available
    targets[options.restoreTargetName] = {
        command: 'dotnet restore',
        options: {
            cwd: '{projectRoot}',
            args: ['--no-dependencies'],
        },
        dependsOn: ['^restore'],
        cache: true,
        inputs: [
            '{projectRoot}/*.csproj',
            '{projectRoot}/*.fsproj',
            '{projectRoot}/*.vbproj',
        ],
        outputs: ['{projectRoot}/obj'],
        metadata: {
            technologies,
            description: 'Restore .NET project dependencies',
            help: {
                command: 'dotnet restore --help',
                example: {
                    options: {},
                },
            },
        },
    };

    // Clean target - always available
    targets[options.cleanTargetName] = {
        command: 'dotnet clean',
        options: {
            cwd: '{projectRoot}',
        },
        cache: false,
        metadata: {
            technologies,
            description: 'Clean build artifacts',
            help: {
                command: 'dotnet clean --help',
                example: {
                    options: {},
                },
            },
        },
    };

    // Publish target - for executable projects
    if (projectInfo.isExecutable) {
        targets[options.publishTargetName] = {
            command: 'dotnet publish',
            options: {
                cwd: '{projectRoot}',
                args: ['--no-build', '--no-dependencies'],
            },
            dependsOn: ['build'],
            cache: true,
            inputs: baseInputs,
            outputs: ['{projectRoot}/bin/Release/publish'],
            metadata: {
                technologies,
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

    // Pack target - for library projects (non-executable, non-test)
    if (!projectInfo.isExecutable && !projectInfo.isTestProject) {
        targets[options.packTargetName] = {
            command: 'dotnet pack',
            options: {
                cwd: '{projectRoot}',
                args: ['--no-dependencies', '--no-build'],
            },
            dependsOn: ['build'],
            cache: true,
            inputs: baseInputs,
            outputs: ['{projectRoot}/bin/Release/*.nupkg'],
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
                process.stdout.write('\u001b[;0K');
                console.log('Processing', file.file, 'for project', source);
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
