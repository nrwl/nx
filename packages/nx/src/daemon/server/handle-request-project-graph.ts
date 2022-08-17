import { performance } from 'perf_hooks';
import { serializeResult } from '../socket-utils';
import { serverLogger } from './logger';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';
import { respondWithErrorAndExit } from './shutdown-utils';

export async function handleRequestProjectGraph(socket) {
  performance.mark('server-connection');
  serverLogger.requestLog('Client Request for Project Graph Received');

  const result = await getCachedSerializedProjectGraphPromise();
  if (result.error) {
    await respondWithErrorAndExit(
      socket,
      `Error when preparing serialized project graph.`,
      result.error
    );
  }

  const serializedResult = serializeResult(
    result.error,
    result.serializedProjectGraph
  );
  if (!serializedResult) {
    await respondWithErrorAndExit(
      socket,
      `Error when serializing project graph result.`,
      new Error(
        'Critical error when serializing server result, check server logs'
      )
    );
  }

  performance.mark('serialized-project-graph-ready');
  performance.measure(
    'total for creating and serializing project graph',
    'server-connection',
    'serialized-project-graph-ready'
  );

  socket.write(serializedResult, () => {
    performance.mark('serialized-project-graph-written-to-client');
    performance.measure(
      'write project graph to socket',
      'serialized-project-graph-ready',
      'serialized-project-graph-written-to-client'
    );
    // Close the connection once all data has been written so that the client knows when to read it.
    socket.end();
    performance.measure(
      'total for server response',
      'server-connection',
      'serialized-project-graph-written-to-client'
    );
    const bytesWritten = Buffer.byteLength(
      result.serializedProjectGraph,
      'utf-8'
    );
    serverLogger.requestLog(
      `Closed Connection to Client (${bytesWritten} bytes transferred)`
    );
  });
}
