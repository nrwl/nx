import { performance } from 'perf_hooks';
import { serializeResult } from '../socket-utils';
import { serverLogger } from './logger';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';
import { HandlerResult } from './server';

export async function handleRequestProjectGraph(): Promise<HandlerResult> {
  try {
    performance.mark('server-connection');
    serverLogger.requestLog('Client Request for Project Graph Received');

    const result = await getCachedSerializedProjectGraphPromise();
    if (result.error) {
      return {
        description: `Error when preparing serialized project graph.`,
        error: result.error,
      };
    }

    const serializedResult = serializeResult(
      result.error,
      result.serializedProjectGraph
    );
    if (!serializedResult) {
      return {
        description: `Error when serializing project graph result.`,
        error: new Error(
          'Critical error when serializing server result, check server logs'
        ),
      };
    }

    performance.mark('serialized-project-graph-ready');
    performance.measure(
      'total for creating and serializing project graph',
      'server-connection',
      'serialized-project-graph-ready'
    );

    return { response: serializedResult, description: 'project-graph' };
  } catch (e) {
    return {
      description: `Unexpected error when creating Project Graph.`,
      error: e,
    };
  }
}
