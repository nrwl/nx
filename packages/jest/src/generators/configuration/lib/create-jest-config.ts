import {
  createProjectGraphAsync,
  readProjectConfiguration,
  updateJson,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  findRootJestConfig,
  type JestPresetExtension,
} from '../../../utils/config/config-file';
import type { NormalizedJestProjectSchema } from '../schema';
import { getProjectType } from '@nx/js/internal';

export function writeRootJestPreset(
  tree: Tree,
  presetExt: JestPresetExtension
) {
  if (!tree.exists(`jest.preset.${presetExt}`)) {
    if (presetExt === 'mjs') {
      tree.write(
        `jest.preset.${presetExt}`,
        `import { nxPreset } from '@nx/jest/preset.js';

export default { ...nxPreset };`
      );
    } else {
      // js or cjs
      tree.write(
        `jest.preset.${presetExt}`,
        `const nxPreset = require('@nx/jest/preset').default;

module.exports = { ...nxPreset };`
      );
    }
  }
}

export async function createJestConfig(
  tree: Tree,
  options: Partial<NormalizedJestProjectSchema>,
  presetExt: JestPresetExtension
) {
  writeRootJestPreset(tree, presetExt);
  if (options.rootProject) {
    // we don't want any config to be made because the `configurationGenerator` will do it.
    // will copy the template config file
    return;
  }
  const rootJestPath = findRootJestConfig(tree);
  if (!rootJestPath) {
    // if there's not root jest config, we will create one and return
    // this can happen when:
    // - root jest config was renamed => in which case there is migration needed
    // - root project didn't have jest setup => again, no migration is needed
    generateGlobalConfig(tree, options.js);
    return;
  }

  if (tree.read(rootJestPath, 'utf-8').includes('getJestProjectsAsync()')) {
    return;
  }

  // moving from root project config to monorepo-style config
  const { nodes: projects } = await createProjectGraphAsync();
  const rootProject = Object.values(projects).find(
    (projectNode) => projectNode.data?.root === '.'
  );
  // root project might have been removed,
  // if it's missing there's nothing to migrate
  if (!rootProject) {
    return;
  }
  const jestTargetName = Object.entries(rootProject.data?.targets ?? {}).find(
    ([_, t]) =>
      t?.executor === 'nx:run-commands' && t?.options?.command === 'jest'
  )?.[0];
  // if root project doesn't have jest target, there's nothing to migrate
  if (!jestTargetName) {
    return;
  }

  const rootProjectConfig = readProjectConfiguration(tree, rootProject.name);
  const projectType =
    getProjectType(
      tree,
      rootProjectConfig.root,
      rootProjectConfig.projectType
    ) === 'application'
      ? 'app'
      : 'lib';
  const jestProjectConfig = rootJestPath.replace(
    /^jest\.config\./,
    `jest.config.${projectType}.`
  );
  tree.rename(rootJestPath, jestProjectConfig);

  if (tree.exists('tsconfig.spec.json')) {
    updateJson(tree, 'tsconfig.spec.json', (json) => {
      if (Array.isArray(json.include)) {
        json.include = json.include.map((pattern: string) =>
          pattern.replace(
            /^(\.\/)?jest\.config\.(?=[cm]?[jt]s$)/,
            `$1jest.config.${projectType}.`
          )
        );
      }
      return json;
    });
  }

  // The @nx/jest/plugin infers the renamed config with `--config`, but an
  // explicit `jest` target would keep running the workspace config
  const target = rootProjectConfig.targets?.[jestTargetName];
  if (target?.command === 'jest') {
    target.command = `jest --config ${jestProjectConfig}`;
    updateProjectConfiguration(tree, rootProject.name, rootProjectConfig);
  } else if (target?.options?.command === 'jest') {
    target.options.command = `jest --config ${jestProjectConfig}`;
    updateProjectConfiguration(tree, rootProject.name, rootProjectConfig);
  }

  // generate new global config as it was move to project config or is missing
  generateGlobalConfig(tree, options.js);
}

function generateGlobalConfig(tree: Tree, isJS: boolean) {
  const contents = isJS
    ? `const { getJestProjectsAsync } = require('@nx/jest');

module.exports = async () => ({
  projects: await getJestProjectsAsync()
});`
    : `import type { Config } from 'jest';
import { getJestProjectsAsync } from '@nx/jest';

export default async (): Promise<Config> => ({
  projects: await getJestProjectsAsync()
});`;
  tree.write(`jest.config.${isJS ? 'js' : 'ts'}`, contents);
}
