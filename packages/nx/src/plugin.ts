import { createNodesFromFiles, type CreateNodesContextV2, type CreateNodesV2, readJsonFile, type TargetConfiguration } from '@nx/devkit';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

export interface FluffPluginOptions
{
    buildTargetName?: string;
    serveTargetName?: string;
}

interface FluffConfig
{
    version: string;
    targets: Record<string, unknown>;
    defaultTarget?: string;
}

function isFluffConfig(value: unknown): value is FluffConfig
{
    if (typeof value !== 'object' || value === null)
    {
        return false;
    }
    if (!('version' in value) || typeof value.version !== 'string')
    {
        return false;
    }
    return 'targets' in value && typeof value.targets === 'object' && value.targets !== null;
}

function createNodesInternal(
    configFilePath: string,
    opts: FluffPluginOptions,
    ctx: CreateNodesContextV2
): { projects: Record<string, { targets: Record<string, TargetConfiguration> }> }
{
    const projectRoot = dirname(configFilePath);
    const { workspaceRoot } = ctx;
    const absoluteProjectRoot = join(workspaceRoot, projectRoot);

    const isProject = existsSync(join(absoluteProjectRoot, 'project.json')) ||
        existsSync(join(absoluteProjectRoot, 'package.json'));

    if (!isProject)
    {
        return { projects: {} };
    }
    const fluffConfigPath = join(workspaceRoot, configFilePath);

    let fluffConfig: FluffConfig | null = null;
    try
    {
        const rawConfig: unknown = readJsonFile(fluffConfigPath);
        if (!isFluffConfig(rawConfig))
        {
            return { projects: {} };
        }
        fluffConfig = rawConfig;
    }
    catch
    {
        return { projects: {} };
    }

    if (!fluffConfig)
    {
        return { projects: {} };
    }

    const buildTargetName = opts.buildTargetName ?? 'build';
    const serveTargetName = opts.serveTargetName ?? 'serve';

    const targets: Record<string, TargetConfiguration> = {};

    targets[buildTargetName] = {
        executor: '@fluffjs/nx:build',
        outputs: ['{options.outputPath}'],
        options: {
            configFile: configFilePath,
            outputPath: `dist/${projectRoot}`
        },
        cache: true
    };

    targets[serveTargetName] = {
        executor: '@fluffjs/nx:serve',
        options: {
            configFile: configFilePath
        }
    };

    return {
        projects: {
            [projectRoot]: {
                targets
            }
        }
    };
}

export const createNodesV2: CreateNodesV2<FluffPluginOptions> = [
    '**/fluff.json',
    async(
        configFiles: readonly string[],
        options: FluffPluginOptions | undefined,
        context: CreateNodesContextV2
    ): Promise<Awaited<ReturnType<typeof createNodesFromFiles>>> =>
    {
        const result = await createNodesFromFiles(
            (configFile, innerOpts, innerCtx) => createNodesInternal(configFile, innerOpts ?? {}, innerCtx),
            configFiles,
            options,
            context
        );
        return result;
    }
];
