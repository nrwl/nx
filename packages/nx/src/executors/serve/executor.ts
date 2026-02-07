import type { ExecutorContext } from '@nx/devkit';
import { Cli } from '@fluffjs/cli';
import { join } from 'path';

export interface ServeExecutorSchema
{
    configFile: string;
    target?: string;
    port?: number;
    host?: string;
}

export default async function runExecutor(
    options: ServeExecutorSchema,
    context: ExecutorContext
): Promise<{ success: boolean }>
{
    const projectRoot = context.projectsConfigurations?.projects[context.projectName ?? '']?.root ?? '';
    const workspaceRoot = context.root;

    const cwd = join(workspaceRoot, projectRoot);

    const cli = new Cli({ cwd });

    const args: string[] = ['serve'];

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
        console.error('Fluff serve failed:', error);
        return { success: false };
    }
}
