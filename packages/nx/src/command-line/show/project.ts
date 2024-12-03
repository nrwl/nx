import { output } from '../../utils/output';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { ShowProjectOptions } from './command-object';
import { generateGraph } from '../graph/graph';

export async function showProjectHandler(
  args: ShowProjectOptions
): Promise<void> {
  const graph = await createProjectGraphAsync();
  const node = graph.nodes[args.projectName];
  if (!node) {
    console.log(`Could not find project ${args.projectName}`);
    process.exit(1);
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
  await output.drain();
}
