import { createProjectGraphAsync } from '../project-graph/project-graph';

export async function show(args: { object: 'projects' }): Promise<void> {
  if (args.object == 'projects') {
    const graph = await createProjectGraphAsync();
    const projects = Object.keys(graph.nodes).join('\n');
    if (projects.length) {
      console.log(projects);
    }
  } else {
    throw new Error(`Unrecognized option: ${args.object}`);
  }
}
