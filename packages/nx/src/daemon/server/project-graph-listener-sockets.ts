import { Socket } from 'net';
import { ProjectGraph } from '../../config/project-graph';
import { handleResult } from './server';

export let registeredProjectGraphListenerSockets: Socket[] = [];

export function removeRegisteredProjectGraphListenerSocket(socket: Socket) {
  registeredProjectGraphListenerSockets =
    registeredProjectGraphListenerSockets.filter((s) => s !== socket);
}

export function hasRegisteredProjectGraphListenerSockets() {
  return registeredProjectGraphListenerSockets.length > 0;
}

export async function notifyProjectGraphListenerSockets(
  projectGraph: ProjectGraph
) {
  if (!hasRegisteredProjectGraphListenerSockets()) {
    return;
  }

  await Promise.all(
    registeredProjectGraphListenerSockets.map((socket) =>
      handleResult(socket, 'PROJECT_GRAPH_UPDATED', () =>
        Promise.resolve({
          description: 'Project graph updated',
          response: JSON.stringify(projectGraph),
        })
      )
    )
  );
}
