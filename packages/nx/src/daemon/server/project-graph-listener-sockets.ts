import { Socket } from 'net';
import { ProjectGraph } from '../../config/project-graph.js';
import { ConfigurationSourceMaps } from '../../project-graph/utils/project-configuration-utils.js';
import { handleResult } from './server.js';
import { isV8SerializerEnabled } from '../is-v8-serializer-enabled.js';

export let registeredProjectGraphListenerSockets: Socket[] = [];

export function removeRegisteredProjectGraphListenerSocket(socket: Socket) {
  registeredProjectGraphListenerSockets =
    registeredProjectGraphListenerSockets.filter((s) => s !== socket);
}

export function hasRegisteredProjectGraphListenerSockets() {
  return registeredProjectGraphListenerSockets.length > 0;
}

export async function notifyProjectGraphListenerSockets(
  projectGraph: ProjectGraph,
  sourceMaps: ConfigurationSourceMaps
) {
  if (!hasRegisteredProjectGraphListenerSockets()) {
    return;
  }

  await Promise.all(
    registeredProjectGraphListenerSockets.map((socket) =>
      handleResult(
        socket,
        'PROJECT_GRAPH_UPDATED',
        () =>
          Promise.resolve({
            description: 'Project graph updated',
            response: { projectGraph, sourceMaps },
          }),
        isV8SerializerEnabled() ? 'v8' : 'json'
      )
    )
  );
}
