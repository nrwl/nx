import { createProjectGraphAsync } from '../project-graph/project-graph';

export async function show(args: { object: 'projects' }): Promise<void> {
  if (args.object == 'projects') {
    const graph = await createProjectGraphAsync();
    process.stdout.write(Object.keys(graph.nodes).join('\n'));
  } else {
    throw new Error(`Unrecognized option: ${args.object}`);
  }
}
