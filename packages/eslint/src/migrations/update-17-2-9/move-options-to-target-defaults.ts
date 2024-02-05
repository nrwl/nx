import {
  ProjectConfiguration,
  ProjectGraphProjectNode,
  TargetConfiguration,
  TargetDefaults,
  Tree,
  createProjectGraphAsync,
  formatFiles,
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import {
  forEachExecutorOptions,
  forEachExecutorOptionsInGraph,
} from '@nx/devkit/src/generators/executor-options-utils';
import { Schema } from '../../executors/lint/schema';
import { findEslintFile } from '../../generators/utils/eslint-file';
import { readTargetDefaultsForTarget } from 'nx/src/project-graph/utils/project-configuration-utils';

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);

  // Don't override anything if there are already target defaults for eslint
  if (nxJson.targetDefaults?.['@nx/eslint:lint']) {
    return;
  }

  nxJson.targetDefaults ??= {};

  const graph = await createProjectGraphAsync();

  const lintTargets = new Set<string>();
  forEachExecutorOptionsInGraph(
    graph,
    '@nx/eslint:lint',
    (value, proj, targetName) => {
      lintTargets.add(targetName);
    }
  );

  // Workspace does not use eslint?
  if (lintTargets.size === 0) {
    return;
  }

  const lintDefaults: TargetConfiguration<Partial<Schema>> =
    (nxJson.targetDefaults['@nx/eslint:lint'] = {});

  // All eslint targets have the same name
  if (lintTargets.size === 1) {
    const targetName = Array.from(lintTargets)[0];
    if (nxJson.targetDefaults[targetName]) {
      Object.assign(lintDefaults, nxJson.targetDefaults[targetName]);
    }
  }

  lintDefaults.cache ??= true;

  if (!lintDefaults.inputs) {
    const eslintConfig = findEslintFile(tree);
    lintDefaults.inputs = [
      'default',
      ...(eslintConfig ? [`{workspaceRoot}/${eslintConfig}`] : []),
      '{workspaceRoot}/tools/eslint-rules/**/*',
    ];
  }

  // Cleanup old target defaults
  const projects = graph.nodes;
  const projectMap = getProjects(tree);

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

  let addOutputs = false;
  forEachExecutorOptions<Schema>(
    tree,
    '@nx/eslint:lint',
    (options, proj, targetName, configuration) => {
      const projConfig = projectMap.get(proj);

      // modify lint file patterns
      if (options.lintFilePatterns) {
        const projectRootRegex = new RegExp(`^${projConfig.root}/`);
        projConfig.targets[targetName].options.lintFilePatterns =
          options.lintFilePatterns
            .filter(
              (filePattern) =>
                filePattern !== '{projectRoot}' &&
                filePattern !== projConfig.root
            )
            .map((filePattern) =>
              filePattern.replace(projectRootRegex, '{projectRoot}/')
            );
        // remove lintFilePatterns if empty
        if (
          projConfig.targets[targetName].options.lintFilePatterns.length === 0
        ) {
          delete projConfig.targets[targetName].options.lintFilePatterns;
        }
      }

      // remove inputs if they are not bringing any new inputs
      if (
        projConfig.targets[targetName].inputs &&
        projConfig.targets[targetName].inputs.every((i) =>
          lintDefaults.inputs.includes(i)
        )
      ) {
        delete projConfig.targets[targetName].inputs;
      }

      // remove obsolete eslint config definition, unless it's a custom one
      const projectEslintConfig = findEslintFile(tree, projConfig.root);
      if (
        options.eslintConfig === `${projConfig.root}/${projectEslintConfig}` ||
        options.eslintConfig === `{projectRoot}/${projectEslintConfig}`
      ) {
        delete projConfig.targets[targetName].options.eslintConfig;
      }

      // remove options if empty
      if (
        Object.keys(projConfig.targets[targetName]?.options ?? {}).length === 0
      ) {
        delete projConfig.targets[targetName].options;
      }

      // track output
      if (options.outputFile) {
        addOutputs = true;
      }
      if (
        projConfig.targets[targetName].outputs?.length === 1 &&
        projConfig.targets[targetName].outputs[0] === '{options.outputFile}'
      ) {
        delete projConfig.targets[targetName].outputs;
      }
      updateProjectConfiguration(tree, proj, projConfig);
    }
  );

  if (addOutputs) {
    lintDefaults.outputs = ['{options.outputFile}'];
  }
  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}

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
          projectMap.get(p.name)?.targets?.[targetName]?.executor
        ) === targetDefault
      ) {
        return true;
      }
    }
  }
  return false;
}
