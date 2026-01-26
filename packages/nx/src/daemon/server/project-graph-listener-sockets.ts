import { Socket } from 'net';
import { ProjectGraph } from '../../config/project-graph';
import { ConfigurationSourceMaps } from '../../project-graph/utils/project-configuration-utils';
import { handleResult } from './server';
import { isV8SerializerEnabled } from '../is-v8-serializer-enabled';

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
  sourceMaps: ConfigurationSourceMaps,
  error: Error | null
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
            response: { projectGraph, sourceMaps, error },
          }),
        isV8SerializerEnabled() ? 'v8' : 'json'
      )
    )
  );
}
