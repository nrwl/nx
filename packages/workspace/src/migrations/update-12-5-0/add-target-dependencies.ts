import {
  formatFiles,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { output } from '../../utilities/output';

export async function setTargetDependencies(host: Tree) {
  const config = readWorkspaceConfiguration(host);
  const strictlyOrderedTargets = config.tasksRunnerOptions?.['default']?.options
    ?.strictlyOrderedTargets || ['build'];
  delete config.tasksRunnerOptions?.['default']?.options
    ?.strictlyOrderedTargets;
  config.targetDependencies = config.targetDependencies ?? {};

  const updatedStrictlyOrderedTargets = [];
  strictlyOrderedTargets.forEach((target) => {
    if (!config.targetDependencies[target]) {
      config.targetDependencies[target] = [
        { target, projects: 'dependencies' },
      ];
      updatedStrictlyOrderedTargets.push(target);
    }
  });
  updateWorkspaceConfiguration(host, config);

  if (updatedStrictlyOrderedTargets.length > 0) {
    output.note({
      title: 'Target dependencies have been updated in nx.json',
      bodyLines: [
        `Nx has deprecated strictlyOrderedTargets in favour of targetDependencies.`,
        `Based on your configuration the migration has configured targetDependencies for the following targets: ${updatedStrictlyOrderedTargets.join(
          ', '
        )}.`,
        `Read more here: https://nx.dev/core-concepts/configuration`,
      ],
    });
  }

  await formatFiles(host);
}

export default setTargetDependencies;
