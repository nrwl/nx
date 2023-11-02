import {
  createProjectGraphAsync,
  formatFiles,
  getProjects,
  ProjectConfiguration,
  ProjectGraphProjectNode,
  readNxJson,
  TargetConfiguration,
  TargetDefaults,
  Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { JestExecutorOptions } from '../../executors/jest/schema';
import {
  forEachExecutorOptions,
  forEachExecutorOptionsInGraph,
} from '@nx/devkit/src/generators/executor-options-utils';
import { readTargetDefaultsForTarget } from 'nx/src/project-graph/utils/project-configuration-utils';

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);

  // Don't override anything if there are already target defaults for jest
  if (nxJson.targetDefaults?.['@nx/jest:jest']) {
    return;
  }

  nxJson.targetDefaults ??= {};

  /**
   * A set of targets which does not use any other executors
   */
  const jestTargets = new Set<string>();

  const graph = await createProjectGraphAsync();

  forEachExecutorOptionsInGraph(
    graph,
    '@nx/jest:jest',
    (value, proj, targetName) => {
      jestTargets.add(targetName);
    }
  );

  // Workspace does not use jest?
  if (jestTargets.size === 0) {
    return;
  }
  // Use the project graph so targets which are inferred are considered
  const projects = graph.nodes;
  const projectMap = getProjects(tree);

  const jestDefaults: TargetConfiguration<Partial<JestExecutorOptions>> =
    (nxJson.targetDefaults['@nx/jest:jest'] = {});

  // All jest targets have the same name
  if (jestTargets.size === 1) {
    const targetName = Array.from(jestTargets)[0];
    if (nxJson.targetDefaults[targetName]) {
      Object.assign(jestDefaults, nxJson.targetDefaults[targetName]);
    }
  }

  jestDefaults.cache ??= true;

  const inputs = ['default'];
  inputs.push(nxJson.namedInputs?.production ? '^production' : '^default');
  if (tree.exists('jest.preset.js')) {
    inputs.push('{workspaceRoot}/jest.preset.js');
  }
  jestDefaults.inputs ??= inputs;

  // Remember if there were already defaults so we don't assume the executor default
  const passWithNoTestsPreviouslyInDefaults =
    jestDefaults.options?.passWithNoTests !== undefined;
  const ciCiPreviouslyInDefaults =
    jestDefaults.configurations?.ci?.ci !== undefined;
  const ciCodeCoveragePreviouslyInDefaults =
    jestDefaults.configurations?.ci?.codeCoverage !== undefined;

  jestDefaults.options ??= {};
  jestDefaults.options.passWithNoTests ??= true;
  jestDefaults.configurations ??= {};
  jestDefaults.configurations.ci ??= {};
  jestDefaults.configurations.ci.ci ??= true;
  jestDefaults.configurations.ci.codeCoverage ??= true;

  // Cleanup old target defaults
  for (const [targetDefaultKey, targetDefault] of Object.entries(
    nxJson.targetDefaults
  )) {
    if (
      !isTargetDefaultUsed(
        targetDefault,
        nxJson.targetDefaults,
        projects,
        projectMap
      )
    ) {
      delete nxJson.targetDefaults[targetDefaultKey];
    }
  }

  updateNxJson(tree, nxJson);

  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nx/jest:jest',
    (value, proj, targetName, configuration) => {
      const projConfig = projectMap.get(proj);

      if (!configuration) {
        // Options
        if (value.passWithNoTests === jestDefaults.options.passWithNoTests) {
          delete projConfig.targets[targetName].options.passWithNoTests;
        } else if (!passWithNoTestsPreviouslyInDefaults) {
          projConfig.targets[targetName].options.passWithNoTests ??= false;
        }

        if (Object.keys(projConfig.targets[targetName].options).length === 0) {
          delete projConfig.targets[targetName].options;
        }
      } else if (configuration === 'ci') {
        // CI Config
        if (value.ci === jestDefaults.configurations.ci.ci) {
          delete projConfig.targets[targetName].configurations.ci.ci;
        } else if (ciCiPreviouslyInDefaults) {
          projConfig.targets[targetName].configurations.ci.ci ??= false;
        }
        if (
          value.codeCoverage === jestDefaults.configurations.ci.codeCoverage
        ) {
          delete projConfig.targets[targetName].configurations.ci.codeCoverage;
        } else if (ciCodeCoveragePreviouslyInDefaults) {
          projConfig.targets[targetName].configurations.ci.codeCoverage ??=
            false;
        }

        if (
          Object.keys(projConfig.targets[targetName].configurations.ci)
            .length === 0
        ) {
          delete projConfig.targets[targetName].configurations.ci;
        }
        if (
          Object.keys(projConfig.targets[targetName].configurations).length ===
          0
        ) {
          delete projConfig.targets[targetName].configurations;
        }
      }

      updateProjectConfiguration(tree, proj, projConfig);
    }
  );

  await formatFiles(tree);
}

/**
 * Checks every target on every project to see if one of them uses the target default
 */
function isTargetDefaultUsed(
  targetDefault: Partial<TargetConfiguration>,
  targetDefaults: TargetDefaults,
  projects: Record<string, ProjectGraphProjectNode>,
  projectMap: Map<string, ProjectConfiguration>
) {
  for (const p of Object.values(projects)) {
    for (const targetName in p.data?.targets ?? {}) {
      if (
        readTargetDefaultsForTarget(
          targetName,
          targetDefaults,
          // It might seem like we should use the graph here too but we don't want to pass an executor which was processed in the graph
          projectMap.get(p.name).targets?.[targetName]?.executor
        ) === targetDefault
      ) {
        return true;
      }
    }
  }
  return false;
}
