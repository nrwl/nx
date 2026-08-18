import { createNodesFromFiles, readJsonFile } from '@nx/devkit';
import type { CreateNodes, TargetConfiguration } from '@nx/devkit';
import {
  getAssetOutputPath,
  normalizeAssets,
} from '@nx/js/src/utils/assets/copy-assets-handler';
import { dirname, join, relative } from 'node:path';

export interface AssetEntry {
  glob: string;
  input?: string;
  output?: string;
  ignore?: string[];
  includeIgnoredFiles?: boolean;
}

export interface AssetsJson {
  outDir: string;
  assets: (AssetEntry | string)[];
}

export type ExecutorAsset =
  | {
      input: string;
      glob: string;
      ignore?: string[];
      output: string;
      includeIgnoredFiles?: boolean;
    }
  | string;

/**
 * Expands an assets.json into the shape the copy-assets executor consumes.
 * Shared with the migration-markdown-assets conformance rule so both derive the
 * copied files from the same inputs.
 */
export function toExecutorAssets(
  assetsJson: AssetsJson,
  projectRoot: string
): ExecutorAsset[] {
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

  return [
    ...objectAssets.map((asset) => {
      const input = asset.input ?? projectRoot;
      const output = asset.output ?? '/';
      const ignore =
        input === projectRoot
          ? [
              `${relative(projectRoot, assetsJson.outDir)}/**`,
              'assets.json',
              ...(asset.ignore ?? []),
            ]
          : asset.ignore;
      return {
        input,
        glob: asset.glob,
        ...(ignore?.length ? { ignore } : {}),
        output,
        ...(asset.includeIgnoredFiles ? { includeIgnoredFiles: true } : {}),
      };
    }),
    ...stringAssets,
  ];
}

export const createNodes: CreateNodes = [
  'packages/*/assets.json',
  async (configFiles, _options, context) => {
    return await createNodesFromFiles(
      (configFilePath, _options, context) => {
        const projectRoot = dirname(configFilePath);
        const assetsJson = readJsonFile<AssetsJson>(
          join(context.workspaceRoot, configFilePath)
        );

        const executorAssets = toExecutorAssets(assetsJson, projectRoot);
        const objectAssets = assetsJson.assets.filter(
          (asset): asset is AssetEntry => typeof asset !== 'string'
        );
        const stringAssets = assetsJson.assets.filter(
          (asset): asset is string => typeof asset === 'string'
        );

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
        const inputs: TargetConfiguration['inputs'] = [
          ...positiveInputs,
          ...negativeInputs,
          '{workspaceRoot}/tools/workspace-plugin/**/*',
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
          executor: '@nx/workspace-plugin:copy-assets',
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
