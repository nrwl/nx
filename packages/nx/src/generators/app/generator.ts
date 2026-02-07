import { type Tree, detectPackageManager } from '@nx/devkit';
import { Generator } from '@fluffjs/cli';
import type { PackageManager } from '@fluffjs/cli';
import initGenerator from '../init/generator';

export interface AppGeneratorSchema
{
    name: string;
    directory?: string;
    packageManager?: PackageManager;
}

export default function appGenerator(
    tree: Tree,
    options: AppGeneratorSchema
): void
{
    initGenerator(tree, {});

    const outputDir = options.directory ?? 'apps';

    let packageManager: PackageManager = 'npm';
    const { packageManager: optPm } = options;
    if (optPm)
    {
        packageManager = optPm;
    }
    else
    {
        try
        {
            packageManager = detectPackageManager(tree.root) as PackageManager;
        }
        catch
        {
            packageManager = 'npm';
        }
    }

    const generator = new Generator();
    generator.generate({
        appName: options.name,
        outputDir,
        packageManager
    });
}
