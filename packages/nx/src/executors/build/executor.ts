import type { ExecutorContext } from '@nx/devkit';
import { Cli } from '@fluffjs/cli';
import { join } from 'path';

export interface BuildExecutorSchema
{
    configFile: string;
    outputPath?: string;
    target?: string;
    noGzip?: boolean;
    noMinify?: boolean;
}

export default async function runExecutor(
    options: BuildExecutorSchema,
    context: ExecutorContext
): Promise<{ success: boolean }>
{
    const projectRoot = context.projectsConfigurations?.projects[context.projectName ?? '']?.root ?? '';
    const workspaceRoot = context.root;

    const cwd = join(workspaceRoot, projectRoot);

    const cli = new Cli({
        cwd,
        noGzip: options.noGzip,
        noMinify: options.noMinify
    });

    const args: string[] = ['build'];

    if (options.target)
    {
        args.push(options.target);
    }

    try
    {
        await cli.run(args);
        return { success: true };
    }
    catch(error: unknown)
    {
        console.error('Fluff build failed:', error);
        return { success: false };
    }
}
