import { performance } from 'perf_hooks';
import { serializeResult } from '../socket-utils';
import { serverLogger } from '../logger';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';
import { HandlerResult } from './server';
import { hashArray } from '../../hasher/file-hasher';

let cachedResponse: string | null = null;
let cachedForGraph: string | null = null;
let currentGraphHash: string | null = null;

export function getCurrentProjectGraphHash(): string | null {
  return currentGraphHash;
}

export async function handleRequestProjectGraph(
  clientGraphHash?: string
): Promise<HandlerResult> {
  try {
    performance.mark('server-connection');
    serverLogger.requestLog(
      `Client Request for Project Graph Received. clientGraphHash=${clientGraphHash}, currentGraphHash=${currentGraphHash}`
    );

    const result = await getCachedSerializedProjectGraphPromise();
    if (result.error) {
      return {
        description: `Error when preparing serialized project graph.`,
        error: result.error,
      };
    }

    // Compute hash if graph changed
    if (cachedForGraph !== result.serializedProjectGraph) {
      cachedForGraph = result.serializedProjectGraph;
      currentGraphHash = hashArray([result.serializedProjectGraph]);
      cachedResponse = null; // invalidate
    }

    // If client already has this graph, send a lightweight "not modified" response
    if (clientGraphHash && clientGraphHash === currentGraphHash) {
      performance.mark('serialized-project-graph-ready');
      performance.measure(
        'total for creating and serializing project graph',
        'server-connection',
        'serialized-project-graph-ready'
      );
      return {
        response: JSON.stringify({ notModified: true, hash: currentGraphHash }),
        description: 'project-graph',
      };
    }

    // Reuse the serialized response if we already built it
    if (cachedResponse) {
      performance.mark('serialized-project-graph-ready');
      performance.measure(
        'total for creating and serializing project graph',
        'server-connection',
        'serialized-project-graph-ready'
      );
      return { response: cachedResponse, description: 'project-graph' };
    }

    const serializedResult = serializeResult(
      result.error,
      result.serializedProjectGraph,
      result.serializedSourceMaps
    );
    if (!serializedResult) {
      return {
        description: `Error when serializing project graph result.`,
        error: new Error(
          'Critical error when serializing server result, check server logs'
        ),
      };
    }

    // Append the hash so the client can cache it
    const withHash =
      serializedResult.slice(0, -1) +
      `, "hash": ${JSON.stringify(currentGraphHash)} }`;

    cachedResponse = withHash;

    performance.mark('serialized-project-graph-ready');
    performance.measure(
      'total for creating and serializing project graph',
      'server-connection',
      'serialized-project-graph-ready'
    );

    return { response: cachedResponse, description: 'project-graph' };
  } catch (e) {
    return {
      description: `Unexpected error when creating Project Graph.`,
      error: e,
    };
  }
}
