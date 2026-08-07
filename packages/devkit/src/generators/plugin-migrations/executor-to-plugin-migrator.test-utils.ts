import { dirname } from 'node:path/posix';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import { addProjectConfiguration } from 'nx/src/devkit-exports';
import type { Tree } from 'nx/src/generators/tree';
import type { ProjectGraph } from 'nx/src/config/project-graph';
import type {
  ProjectConfiguration,
  TargetConfiguration,
} from 'nx/src/config/workspace-json-project-json';
import type { CreateNodes } from 'nx/src/project-graph/plugins';
import { TempFs } from '../../../internal-testing-utils';

/**
 * Shared test harness for the executor-to-plugin migrator engine specs.
 *
 * It builds a real (TempFs-backed) workspace with a *synthetic* inferred-target
 * plugin so the engine's real inference path (`retrieveProjectConfigurations`)
 * runs end to end, while keeping the plugin trivial and deterministic.
 *
 * Every whole-workspace inference pass invokes the plugin's `createNodes`
 * function exactly once, so counting `createNodes` invocations counts
 * whole-workspace inference passes — the cost we care about — regardless of
 * which retrieval entry point ran the pass (Phase 1 goes through
 * `getCreateNodesResultsForPlugin`; the Phase 4 verification calls
 * `retrieveProjectConfigurations` directly, once per registration group).
 */

export const SYNTHETIC_CONFIG_FILE = 'build.config.json';
export const SYNTHETIC_CONFIG_GLOB = `**/${SYNTHETIC_CONFIG_FILE}`;
export const SYNTHETIC_PLUGIN_PATH = '@acme/tool/plugin';
export const SYNTHETIC_EXECUTOR = '@acme/tool:build';

export interface SyntheticPluginOptions {
  targetName?: string;
  variant?: string;
}

/**
 * The default inferred (command-based) target the synthetic plugin produces for
 * a project root. Mirrors the shape real plugins produce: a `command`,
 * `options.cwd` (both stripped by the engine), plus `cache`, `inputs` (with an
 * `externalDependencies` entry) and `outputs`.
 */
export function defaultInferredTarget(
  root: string,
  targetName?: string
): TargetConfiguration {
  return {
    command: 'acme-build',
    options: { cwd: root },
    cache: true,
    inputs: ['default', '^default', { externalDependencies: ['acme-tool'] }],
    outputs: ['{projectRoot}/dist'],
  };
}

export type InferredTargetFactory = (
  root: string,
  targetName: string,
  options: SyntheticPluginOptions | undefined,
  /** 1-based count of whole-workspace inference passes so far (this one included). */
  invocation: number
) => TargetConfiguration;

export interface SyntheticPlugin {
  pluginPath: string;
  createNodes: CreateNodes<SyntheticPluginOptions>;
  /** Number of whole-workspace inference passes observed so far. */
  inferenceCount: () => number;
  resetCount: () => void;
}

/**
 * Create a synthetic inferred-target plugin bound to an invocation counter.
 * `inferredTargetFor` lets a test customize what the plugin infers per root
 * (used by fallback/divergence tests).
 */
export function createSyntheticPlugin(
  inferredTargetFor: InferredTargetFactory = defaultInferredTarget,
  pluginPath = SYNTHETIC_PLUGIN_PATH
): SyntheticPlugin {
  let count = 0;
  const createNodes: CreateNodes<SyntheticPluginOptions> = [
    SYNTHETIC_CONFIG_GLOB,
    (configFiles, options) => {
      count++;
      const invocation = count;
      const targetName = options?.targetName ?? 'build';
      return configFiles.map((file) => {
        const dir = dirname(file);
        const root = dir === '' || dir === '.' ? '.' : dir;
        return [
          file,
          {
            projects: {
              [root]: {
                targets: {
                  [targetName]: inferredTargetFor(
                    root,
                    targetName,
                    options,
                    invocation
                  ),
                },
              },
            },
          },
        ] as const;
      });
    },
  ];

  return {
    pluginPath,
    createNodes,
    inferenceCount: () => count,
    resetCount: () => {
      count = 0;
    },
  };
}

export interface FixtureContext {
  tree: Tree;
  fs: TempFs;
  projectGraph: ProjectGraph;
}

export function setupFixture(
  label = 'executor-to-plugin-migrator'
): FixtureContext {
  const fs = new TempFs(label);
  const tree = createTreeWithEmptyWorkspace();
  tree.root = fs.tempDir;

  tree.write(
    'package.json',
    JSON.stringify({ name: 'workspace', version: '0.0.1' })
  );
  fs.createFileSync(
    'package.json',
    JSON.stringify({ name: 'workspace', version: '0.0.1' })
  );

  const projectGraph: ProjectGraph = {
    nodes: {},
    dependencies: {},
    externalNodes: {},
  };

  return { tree, fs, projectGraph };
}

export function teardownFixture(fs: TempFs): void {
  fs.cleanup();
}

export interface AddProjectOptions {
  name: string;
  root: string;
  /** target name on the project (defaults to `build`) */
  targetName?: string;
  executor?: string;
  target?: Partial<TargetConfiguration>;
}

/**
 * Adds a project with an executor target to both the Tree (project.json) and the
 * graph, and drops the synthetic plugin's marker config file on disk so the
 * plugin infers a target for it.
 */
export function addExecutorProject(
  ctx: FixtureContext,
  opts: AddProjectOptions
): ProjectConfiguration {
  const targetName = opts.targetName ?? 'build';
  const executor = opts.executor ?? SYNTHETIC_EXECUTOR;
  const target: TargetConfiguration = {
    executor,
    ...opts.target,
  };
  const project: ProjectConfiguration = {
    name: opts.name,
    root: opts.root,
    projectType: 'application',
    targets: { [targetName]: target },
  };

  addProjectConfiguration(ctx.tree, opts.name, project);
  ctx.projectGraph.nodes[opts.name] = {
    name: opts.name,
    type: 'app',
    data: {
      root: opts.root,
      targets: project.targets,
    } as any,
  };

  const configPath =
    opts.root === '.'
      ? SYNTHETIC_CONFIG_FILE
      : `${opts.root}/${SYNTHETIC_CONFIG_FILE}`;
  ctx.fs.createFileSync(configPath, '{}');

  return project;
}
