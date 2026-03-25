import {
  createNodesFromFiles,
  CreateNodesV2,
  readJsonFile,
  TargetConfiguration,
} from '@nx/devkit';
import { dirname, join } from 'node:path';

interface AssetEntry {
  glob: string;
  ignore?: string[];
}

interface AssetsJson {
  outDir: string;
  assets: AssetEntry[];
}

export const createNodesV2: CreateNodesV2 = [
  'packages/*/assets.json',
  async (configFiles, _options, context) => {
    return await createNodesFromFiles(
      (configFilePath, _options, context) => {
        const projectRoot = dirname(configFilePath);
        const assetsJson = readJsonFile<AssetsJson>(
          join(context.workspaceRoot, configFilePath)
        );

        // Derive inputs from asset globs — positive patterns first, then negations
        const positiveInputs = new Set<string>();
        const negativeInputs = new Set<string>();
        for (const asset of assetsJson.assets) {
          positiveInputs.add(`{projectRoot}/${asset.glob}`);
          if (asset.ignore) {
            for (const pattern of asset.ignore) {
              negativeInputs.add(`!{projectRoot}/${pattern}`);
            }
          }
        }
        const inputs = [...positiveInputs, ...negativeInputs];

        // Build executor assets with input/output fields, always ignoring outDir
        const executorAssets = assetsJson.assets.map((asset) => ({
          input: projectRoot,
          glob: asset.glob,
          ignore: [`${assetsJson.outDir}/**`, ...(asset.ignore ?? [])],
          output: '/',
        }));

        // Derive outputs from asset globs — assets are copied into outDir
        const outputs = assetsJson.assets.map(
          (asset) => `{projectRoot}/${assetsJson.outDir}/${asset.glob}`
        );

        const target: TargetConfiguration = {
          executor: '@nx/workspace-plugin:legacy-post-build',
          cache: true,
          inputs,
          outputs,
          options: {
            outputPath: assetsJson.outDir,
            assets: executorAssets,
          },
        };

        return {
          projects: {
            [projectRoot]: {
              targets: {
                'copy-assets': target,
              },
            },
          },
        };
      },
      configFiles,
      _options,
      context
    );
  },
];
