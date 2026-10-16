import { readJsonFile, type TargetConfiguration } from '@nx/devkit';
import { globWithWorkspaceContext } from '@nx/devkit/internal';
import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import {
  createScriptNodes,
  quoteShellArg,
  type ScriptPluginOptions,
  type ScriptTargets,
} from './create-script-nodes';

export interface NodeScriptsPluginOptions extends ScriptPluginOptions {
  /**
   * `dependsOn` for `bin` targets whose file is build output (not a tracked
   * workspace file). Defaults to `["build"]`.
   */
  binDependsOn?: string[];
}

export const createNodes = createScriptNodes<NodeScriptsPluginOptions>({
  cacheName: 'js-node-scripts',
  technology: 'node',
  claims: (shebang) => shebang.interpreter === 'node',
  command: (file, shebang, watch) =>
    ['node', ...(watch ? ['--watch'] : []), ...shebang.args, file].join(' '),
  extraTargets: createBinTargets,
});

export const createNodesV2 = createNodes;

async function createBinTargets(
  projectRoot: string,
  workspaceRoot: string,
  options: NodeScriptsPluginOptions | undefined
): Promise<ScriptTargets> {
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return {};
  }
  const bins = readBinEntries(readJsonFile(packageJsonPath));
  if (!bins.length) {
    return {};
  }

  const binFiles = bins.map(([, path]) =>
    posix.join(projectRoot, posix.normalize(path))
  );
  const tracked = new Set(
    await globWithWorkspaceContext(workspaceRoot, binFiles)
  );

  const targets: ScriptTargets = {};
  bins.forEach(([name, path], i) => {
    const target: TargetConfiguration = {
      command: `node ${quoteShellArg(posix.normalize(path))}`,
      options: { cwd: projectRoot },
      cache: false,
      metadata: {
        technologies: ['node'],
        description: `Runs the ${name} bin`,
      },
    };
    if (!tracked.has(binFiles[i])) {
      target.dependsOn = options?.binDependsOn ?? ['build'];
    }
    targets[name] = target;
  });
  return targets;
}

function readBinEntries(packageJson: {
  name?: string;
  bin?: string | Record<string, string>;
}): [string, string][] {
  const { name, bin } = packageJson;
  if (typeof bin === 'string') {
    return name ? [[name.replace(/^@[^/]+\//, ''), bin]] : [];
  }
  return Object.entries(bin ?? {}).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  );
}
