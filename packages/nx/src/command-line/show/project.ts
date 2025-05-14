import { output } from '../../utils/output';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { ShowProjectOptions } from './command-object';
import { generateGraph } from '../graph/graph';
import { findMatchingProjects } from '../../utils/find-matching-projects';

export async function showProjectHandler(
  args: ShowProjectOptions
): Promise<void> {
  performance.mark('code-loading:end');
  performance.measure('code-loading', 'init-local', 'code-loading:end');
  const graph = await createProjectGraphAsync();
  let node = graph.nodes[args.projectName];
  if (!node) {
    const projects = findMatchingProjects([args.projectName], graph.nodes);
    if (projects.length === 1) {
      const projectName = projects[0];
      node = graph.nodes[projectName];
    } else if (projects.length > 1) {
      output.error({
        title: `Multiple projects matched:`,
        bodyLines:
          projects.length > 100 ? [...projects.slice(0, 100), '...'] : projects,
      });
      console.log(
        `Multiple projects matched:\n  ${(projects.length > 100
          ? [...projects.slice(0, 100), '...']
          : projects
        ).join('  \n')}`
      );
      process.exit(1);
    } else {
      console.log(`Could not find project ${args.projectName}`);
      process.exit(1);
    }
  }
  if (args.json) {
    console.log(JSON.stringify(node.data));
  } else if (args.web) {
    await generateGraph(
      {
        view: 'project-details',
        focus: node.name,
        watch: true,
        open: args.open ?? true,
      },
      []
    );
  } else {
    const chalk = require('chalk') as typeof import('chalk');
    const logIfExists = (label, key: keyof (typeof node)['data']) => {
      if (node.data[key]) {
        console.log(`${chalk.bold(label)}: ${node.data[key]}`);
      }
    };

    logIfExists('Name', 'name');
    logIfExists('Root', 'root');
    logIfExists('Source Root', 'sourceRoot');
    logIfExists('Tags', 'tags');
    logIfExists('Implicit Dependencies', 'implicitDependencies');

    const targets = Object.entries(node.data.targets ?? {});
    const maxTargetNameLength = Math.max(...targets.map(([t]) => t.length));
    const maxExecutorNameLength = Math.max(
      ...targets.map(([, t]) => t?.executor?.length ?? 0)
    );

    if (targets.length > 0) {
      console.log(`${chalk.bold('Targets')}: `);
      for (const [target, targetConfig] of targets) {
        const executorCommandText =
          targetConfig.metadata?.scriptContent ??
          targetConfig?.options?.command ??
          (targetConfig?.options?.commands?.length === 1
            ? targetConfig.options.commands[0]
            : targetConfig?.executor) ??
          '';
        console.log(
          `- ${chalk.bold(
            (target + ':').padEnd(maxTargetNameLength + 2)
          )} ${executorCommandText.padEnd(maxExecutorNameLength + 2)} ${(() => {
            const configurations = Object.keys(
              targetConfig.configurations ?? {}
            );
            if (configurations.length) {
              return chalk.dim(configurations.join(', '));
            }
            return '';
          })()}`
        );
      }
    }
  }

  // TODO: Find a better fix for this
  await new Promise((res) => setImmediate(res));
  await output.drain();
}
