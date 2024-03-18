import { Server } from 'net';
import { handleServerProcessTermination } from './shutdown-utils';

export async function handleRequestShutdown(
  server: Server,
  numberOfConnections: number
) {
  // 1 connection is the client asking to shut down
  if (numberOfConnections > 1) {
    return {
      description: `Unable to shutdown the daemon. ${numberOfConnections} connections are open.`,
      response: '{}',
    };
  } else {
    setTimeout(async () => {
      await handleServerProcessTermination({
        server,
        reason: 'Request to shutdown',
      });
    }, 0);
    return {
      description: 'Shutdown initiated',
      response: '{}',
    };
  }
}
