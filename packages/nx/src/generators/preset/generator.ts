import { type Tree, detectPackageManager } from '@nx/devkit';
import type { PackageManager } from '@fluffjs/cli';
import initGenerator from '../init/generator';
import appGenerator from '../app/generator';

export interface PresetGeneratorSchema
{
    name: string;
    appName?: string;
}

export default function presetGenerator(
    tree: Tree,
    options: PresetGeneratorSchema
): void
{
    initGenerator(tree, {});

    const appName = options.appName ?? options.name;
    const detectedPm = detectPackageManager(tree.root);

    appGenerator(tree, {
        name: appName,
        directory: 'apps',
        packageManager: detectedPm as PackageManager
    });
}
