import { ProjectGraph } from '../../config/project-graph';

export function getOutputPath(
  projectGraph: ProjectGraph,
  name: string
): string {
  const node = projectGraph.nodes[name];
  if (node == null) {
    throw new Error(`Could not find project with name "${name}"`);
  }

  const buildTarget = node.data.targets?.build;
  if (buildTarget == null) {
    throw new Error(
      `Project "${name}" does not have build target, output path can't be inferred`
    );
  }

  const outputPath: string | undefined = buildTarget.options.outputPath;
  if (outputPath == null) {
    throw new Error(
      `Project "${name}" does not have an output path on its build target`
    );
  }

  return outputPath;
}
