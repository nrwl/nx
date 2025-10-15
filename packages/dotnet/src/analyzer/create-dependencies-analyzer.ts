import { dirname, join, parse, relative, resolve } from 'node:path';

import {
    CreateDependencies,
    DependencyType,
    logger,
    normalizePath,
    ProjectConfiguration,
    RawProjectGraphDependency,
} from '@nx/devkit';

import { DotNetPluginOptions } from './create-nodes-analyzer';
import { analyzeProjects, getProjectAnalysis } from './analyzer-client';

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

export const createDependenciesAnalyzer: CreateDependencies<
    DotNetPluginOptions
> = async (_, ctx) => {
    const dependencies: RawProjectGraphDependency[] = [];

    const rootMap = createProjectRootMappings(ctx.projects);

    // Collect all project files to analyze
    const projectFiles: string[] = [];
    for (const [source] of Object.entries(ctx.projects)) {
        const files = ctx.filesToProcess.projectFileMap[source] || [];
        for (const file of files) {
            const { ext } = parse(file.file);
            if (['.csproj', '.fsproj', '.vbproj'].includes(ext)) {
                projectFiles.push(file.file);
            }
        }
    }

    // Analyze all projects if we have any
    if (projectFiles.length > 0) {
        try {
            analyzeProjects(projectFiles);
        } catch (err) {
            const error = err as Error;
            logger.warn(
                `MSBuild analyzer failed for dependency detection: ${error.message}`
            );
            // Don't throw - return empty dependencies and let the fallback handle it
            return dependencies;
        }
    }

    // Build dependencies from analyzer results
    for (const [source] of Object.entries(ctx.projects)) {
        const files = ctx.filesToProcess.projectFileMap[source] || [];

        for (const file of files) {
            const { ext } = parse(file.file);
            if (['.csproj', '.fsproj', '.vbproj'].includes(ext)) {
                const analysis = getProjectAnalysis(file.file);

                if (!analysis) {
                    logger.warn(
                        `No analysis result found for ${file.file}, skipping dependency detection`
                    );
                    continue;
                }

                if (analysis.error) {
                    logger.warn(
                        `Error analyzing ${file.file}: ${analysis.error}, skipping dependency detection`
                    );
                    continue;
                }

                // Use project references from analyzer
                for (const reference of analysis.projectReferences) {
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
