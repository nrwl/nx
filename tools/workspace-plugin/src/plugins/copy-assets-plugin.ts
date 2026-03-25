import {
  createNodesFromFiles,
  CreateNodesV2,
  readJsonFile,
  TargetConfiguration,
} from '@nx/devkit';
import { basename, dirname, join } from 'node:path';

interface AssetEntry {
  glob: string;
  ignore?: string[];
}

interface AssetsJson {
  outDir: string;
  assets: (AssetEntry | string)[];
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

        // Separate string assets (passed through as-is) from object assets
        const objectAssets: AssetEntry[] = [];
        const stringAssets: string[] = [];
        for (const asset of assetsJson.assets) {
          if (typeof asset === 'string') {
            stringAssets.push(asset);
          } else {
            objectAssets.push(asset);
          }
        }

        // Derive inputs from object asset globs — positive patterns first, then negations
        const positiveInputs = new Set<string>();
        const negativeInputs = new Set<string>();
        for (const asset of objectAssets) {
          positiveInputs.add(`{projectRoot}/${asset.glob}`);
          if (asset.ignore) {
            for (const pattern of asset.ignore) {
              negativeInputs.add(`!{projectRoot}/${pattern}`);
            }
          }
        }
        // String assets are workspace-relative paths
        for (const asset of stringAssets) {
          positiveInputs.add(`{workspaceRoot}/${asset}`);
        }
        const inputs = [...positiveInputs, ...negativeInputs];

        // Build executor assets, always ignoring outDir for object assets
        const executorAssets: (AssetEntry | string)[] = [
          ...objectAssets.map((asset) => ({
            input: projectRoot,
            glob: asset.glob,
            ignore: [`${assetsJson.outDir}/**`, ...(asset.ignore ?? [])],
            output: '/',
          })),
          ...stringAssets,
        ];

        // Derive outputs from asset globs
        const outputs = [
          ...objectAssets.map(
            (asset) => `{projectRoot}/${assetsJson.outDir}/${asset.glob}`
          ),
          ...stringAssets.map(
            (asset) => `{projectRoot}/${assetsJson.outDir}/${basename(asset)}`
          ),
        ];

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
