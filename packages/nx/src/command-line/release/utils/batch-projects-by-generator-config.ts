import { ProjectGraph } from '../../../config/project-graph';
import { deepEquals } from '../../../utils/json-diff';
import { ReleaseGroupWithName } from '../config/filter-release-groups';

/**
 * To be most efficient with our invocations of runVersionOnProjects, we want to batch projects by their generator and generator options
 * within any given release group.
 */
export function batchProjectsByGeneratorConfig(
  projectGraph: ProjectGraph,
  releaseGroup: ReleaseGroupWithName,
  projectNamesToBatch: string[]
) {
  const configBatches = new Map<string, string[]>();
  for (const projectName of projectNamesToBatch) {
    const project = projectGraph.nodes[projectName];
    const generator =
      project.data.release?.version?.generator ||
      releaseGroup.version.generator;
    const generatorOptions = {
      ...releaseGroup.version.generatorOptions,
      ...project.data.release?.version?.generatorOptions,
    };

    let found = false;
    for (const [key, projects] of configBatches) {
      const [existingGenerator, existingOptions] = JSON.parse(key);
      if (
        generator === existingGenerator &&
        deepEquals(generatorOptions, existingOptions)
      ) {
        projects.push(projectName);
        found = true;
        break;
      }
    }

    if (!found) {
      configBatches.set(JSON.stringify([generator, generatorOptions]), [
        projectName,
      ]);
    }
  }
  return configBatches;
}
