import {
  createProjectGraphAsync,
  formatFiles,
  getProjects,
  joinPathFragments,
  logger,
  updateProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import {
  everyServerTarget,
  isTargetAlsoInPackageJson,
} from '../../utils/targets';

const rspackConfigFileNames = ['js', 'ts', 'mjs', 'mts', 'cjs', 'cts'].map(
  (extension) => `rspack.config.${extension}`
);

export default async function update(tree: Tree) {
  let projectGraph: ProjectGraph;
  try {
    // The graph holds the targets as the builder sees them, with targetDefaults
    // and inferred targets merged in
    projectGraph = await createProjectGraphAsync();
  } catch (error) {
    logger.warn(
      `Skipped removing the "@angular-devkit/build-angular:ssr-dev-server" targets of Rspack projects because the project graph could not be created: ${
        error instanceof Error ? error.message : error
      }`
    );
    return;
  }

  const removedTargets: string[] = [];
  for (const [projectName, project] of getProjects(tree)) {
    if (
      !rspackConfigFileNames.some((fileName) =>
        tree.exists(joinPathFragments(project.root, fileName))
      )
    ) {
      continue;
    }

    let updated = false;
    const targets = project.targets ?? {};
    for (const targetName of Object.keys(targets)) {
      const target =
        projectGraph.nodes[projectName]?.data.targets?.[targetName];
      if (
        target?.executor === '@angular-devkit/build-angular:ssr-dev-server' &&
        everyServerTarget(
          target,
          (serverTarget) =>
            !projectGraph.nodes[serverTarget.project]?.data.targets?.[
              serverTarget.target
            ]
        ) &&
        // Only project.json is written, so a package.json entry could keep the target
        !isTargetAlsoInPackageJson(tree, project.root, targetName)
      ) {
        delete targets[targetName];
        removedTargets.push(`${projectName}:${targetName}`);
        updated = true;
      }
    }

    if (updated) {
      updateProjectConfiguration(tree, projectName, project);
    }
  }

  await formatFiles(tree);

  if (removedTargets.length) {
    return [
      `Removed ${removedTargets.join(', ')}. These "@angular-devkit/build-angular:ssr-dev-server" targets pointed at a server target that doesn't exist, so they couldn't run. Use "nx serve <project>" to serve the application instead.`,
    ];
  }
}
