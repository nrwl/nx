import { type Tree, detectPackageManager, joinPathFragments } from '@nx/devkit';
import { Generator } from '@fluffjs/cli';
import type { PackageManager } from '@fluffjs/cli';
import initGenerator from '../init/generator';

export interface AppGeneratorSchema
{
    name: string;
    directory?: string;
    packageManager?: PackageManager;
    skipInstall?: boolean;
}

function toKebabCase(str: string): string
{
    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
}

export default function appGenerator(
    tree: Tree,
    options: AppGeneratorSchema
): void
{
    initGenerator(tree, {});

    const outputDir = options.directory ?? 'apps';
    const kebabName = toKebabCase(options.name);
    const projectRoot = joinPathFragments(outputDir, kebabName);

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

    const projectJson = {
        name: kebabName,
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        projectType: 'application',
        sourceRoot: `${projectRoot}/src`,
        targets: {}
    };

    tree.write(joinPathFragments(projectRoot, 'project.json'), JSON.stringify(projectJson, null, 2));

    const generator = new Generator();
    generator.generate({
        appName: options.name,
        outputDir,
        packageManager,
        skipInstall: options.skipInstall
    });
}
