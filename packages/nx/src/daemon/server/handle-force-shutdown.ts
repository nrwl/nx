import { Server } from 'net';
import { handleServerProcessTermination } from './shutdown-utils.js';
import { openSockets } from './server.js';

export async function handleForceShutdown(server: Server) {
  setTimeout(async () => {
    await handleServerProcessTermination({
      server,
      reason: 'Request to shutdown',
      sockets: openSockets,
    });
  });
  return {
    description: 'Shutdown initiated',
    response: '{}',
  };
}
