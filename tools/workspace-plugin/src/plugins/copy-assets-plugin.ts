import {
  createNodesFromFiles,
  CreateNodesV2,
  readJsonFile,
  TargetConfiguration,
} from '@nx/devkit';
import {
  getAssetOutputPath,
  normalizeAssets,
} from '@nx/js/src/utils/assets/copy-assets-handler';
import { dirname, join, relative } from 'node:path';

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

        // Build executor assets, always ignoring outDir for object assets
        const executorAssets: (
          | { input: string; glob: string; ignore: string[]; output: string }
          | string
        )[] = [
          ...objectAssets.map((asset) => ({
            input: projectRoot,
            glob: asset.glob,
            ignore: [
              `${relative(projectRoot, assetsJson.outDir)}/**`,
              ...(asset.ignore ?? []),
            ],
            output: '/',
          })),
          ...stringAssets,
        ];

        // Normalize assets using CopyAssetsHandler's logic to derive outputs
        const projectDir = join(context.workspaceRoot, projectRoot);
        const outputDir = join(context.workspaceRoot, assetsJson.outDir);
        const normalized = normalizeAssets(
          executorAssets,
          context.workspaceRoot,
          projectDir,
          outputDir
        );

        // Derive inputs — positive patterns first, then negations
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
        for (const asset of stringAssets) {
          positiveInputs.add(`{workspaceRoot}/${asset}`);
        }
        const inputs = [...positiveInputs, ...negativeInputs];

        // Derive outputs using the same dest logic as CopyAssetsHandler
        const outputs = normalized.map(
          (entry) =>
            `{workspaceRoot}/${getAssetOutputPath(entry.pattern, entry)}`
        );

        const target: TargetConfiguration = {
          executor: '@nx/workspace-plugin:legacy-post-build',
          cache: true,
          inputs,
          outputs,
          options: {
            outputPath: relative(projectRoot, assetsJson.outDir),
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
