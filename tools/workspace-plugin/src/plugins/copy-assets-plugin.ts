import {
  createNodesFromFiles,
  CreateNodesV2,
  InputDefinition,
  readJsonFile,
  TargetConfiguration,
} from '@nx/devkit';
import { dirname, join, relative } from 'node:path';
import { getAssetOutputPath, normalizeAssets } from './normalize-assets';

interface AssetEntry {
  glob: string;
  input?: string;
  output?: string;
  ignore?: string[];
  includeIgnoredFiles?: boolean;
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

        // Build executor assets
        const executorAssets: (
          | {
              input: string;
              glob: string;
              ignore?: string[];
              output: string;
              includeIgnoredFiles?: boolean;
            }
          | string
        )[] = [
          ...objectAssets.map((asset) => {
            const input = asset.input ?? projectRoot;
            const output = asset.output ?? '/';
            const ignore =
              input === projectRoot
                ? [
                    `${relative(projectRoot, assetsJson.outDir)}/**`,
                    ...(asset.ignore ?? []),
                  ]
                : asset.ignore;
            return {
              input,
              glob: asset.glob,
              ...(ignore?.length ? { ignore } : {}),
              output,
              ...(asset.includeIgnoredFiles
                ? { includeIgnoredFiles: true }
                : {}),
            };
          }),
          ...stringAssets,
        ];

        // Normalize assets to derive outputs
        const projectDir = join(context.workspaceRoot, projectRoot);
        const outputDir = join(context.workspaceRoot, assetsJson.outDir);
        const normalized = normalizeAssets(
          executorAssets,
          context.workspaceRoot,
          projectDir,
          outputDir
        );

        // Derive inputs — positive patterns first, then negations,
        // then dependentTasksOutputFiles for gitignored assets
        const positiveInputs = new Set<string>();
        const negativeInputs = new Set<string>();
        const dependentOutputGlobs = new Set<string>();
        for (const asset of objectAssets) {
          const input = asset.input ?? projectRoot;
          if (asset.includeIgnoredFiles) {
            dependentOutputGlobs.add(asset.glob);
          } else if (input === projectRoot) {
            positiveInputs.add(`{projectRoot}/${asset.glob}`);
            if (asset.ignore) {
              for (const pattern of asset.ignore) {
                negativeInputs.add(`!{projectRoot}/${pattern}`);
              }
            }
          } else {
            positiveInputs.add(`{workspaceRoot}/${input}/${asset.glob}`);
          }
        }
        for (const asset of stringAssets) {
          positiveInputs.add(`{workspaceRoot}/${asset}`);
        }
        const inputs: (string | InputDefinition)[] = [
          ...positiveInputs,
          ...negativeInputs,
        ];
        for (const glob of dependentOutputGlobs) {
          inputs.push({
            dependentTasksOutputFiles: glob,
            transitive: true,
          });
        }

        // Derive outputs
        const outputs = normalized.map((entry) => {
          const outputPath = getAssetOutputPath(entry.pattern, entry);
          if (outputPath.startsWith(projectRoot + '/')) {
            return `{projectRoot}/${outputPath.slice(projectRoot.length + 1)}`;
          }
          return `{workspaceRoot}/${outputPath}`;
        });

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
