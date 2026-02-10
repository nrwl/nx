import { output } from '../../utils/output';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import { ShowProjectOptions } from './command-object';
import { generateGraph } from '../graph/graph';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { workspaceRoot } from '../../utils/workspace-root';
import { readNxJson } from '../../config/configuration';
import { calculateDefaultProjectName } from '../../config/calculate-default-project-name';
import { reportCommandRunEvent } from '../../analytics';
import { exitAndFlushAnalytics } from '../../analytics/analytics';

export async function showProjectHandler(
  args: ShowProjectOptions
): Promise<void> {
  performance.mark('code-loading:end');
  reportCommandRunEvent('show project');
  performance.measure('code-loading', 'init-local', 'code-loading:end');
  const graph = await createProjectGraphAsync();

  let projectName = args.projectName;

  // If no project name is provided, try to infer from cwd
  if (!projectName) {
    const nxJson = readNxJson();
    projectName = calculateDefaultProjectName(
      process.cwd(),
      workspaceRoot,
      readProjectsConfigurationFromProjectGraph(graph),
      nxJson
    );

    if (!projectName) {
      output.error({
        title: 'Could not find a project in the current working directory.',
        bodyLines: [
          `Please specify a project name using:`,
          `  nx show project <project-name>`,
          ``,
          `Or run this command from within a project directory.`,
        ],
      });
      exitAndFlushAnalytics(1);
    }
  }

  let node = graph.nodes[projectName];
  if (!node) {
    const projects = findMatchingProjects([projectName], graph.nodes);
    if (projects.length === 1) {
      const matchedProjectName = projects[0];
      node = graph.nodes[matchedProjectName];
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
      exitAndFlushAnalytics(1);
    } else {
      console.log(`Could not find project ${projectName}`);
      exitAndFlushAnalytics(1);
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
    const pc = require('picocolors') as typeof import('picocolors');
    const logIfExists = (label, key: keyof (typeof node)['data']) => {
      if (node.data[key]) {
        console.log(`${pc.bold(label)}: ${node.data[key]}`);
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
      console.log(`${pc.bold('Targets')}: `);
      for (const [target, targetConfig] of targets) {
        const executorCommandText =
          targetConfig.metadata?.scriptContent ??
          targetConfig?.options?.command ??
          (targetConfig?.options?.commands?.length === 1
            ? targetConfig.options.commands[0]
            : targetConfig?.executor) ??
          '';
        console.log(
          `- ${pc.bold(
            (target + ':').padEnd(maxTargetNameLength + 2)
          )} ${executorCommandText.padEnd(maxExecutorNameLength + 2)} ${(() => {
            const configurations = Object.keys(
              targetConfig.configurations ?? {}
            );
            if (configurations.length) {
              return pc.dim(configurations.join(', '));
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
