import { type Tree, readJson, updateJson } from '@nx/devkit';

export interface InitGeneratorSchema
{
    skipFormat?: boolean;
}

interface NxJson
{
    plugins?: (string | { plugin: string; options?: Record<string, unknown> })[];
}

function isPluginRegistered(nxJson: NxJson): boolean
{
    if (!nxJson.plugins)
    {
        return false;
    }

    return nxJson.plugins.some(plugin =>
    {
        if (typeof plugin === 'string')
        {
            return plugin === '@fluffjs/nx';
        }
        return plugin.plugin === '@fluffjs/nx';
    });
}

export default function initGenerator(
    tree: Tree,
    _options: InitGeneratorSchema
): void
{
    const nxJsonPath = 'nx.json';

    if (!tree.exists(nxJsonPath))
    {
        return;
    }

    const nxJson = readJson<NxJson>(tree, nxJsonPath);

    if (isPluginRegistered(nxJson))
    {
        return;
    }

    updateJson<NxJson>(tree, nxJsonPath, (json) =>
    {
        json.plugins ??= [];

        json.plugins.push({ plugin: '@fluffjs/nx' });

        return json;
    });

    console.log('   ✓ Registered @fluffjs/nx plugin in nx.json');
}
