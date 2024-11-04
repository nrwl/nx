import { Server } from 'net';
import { handleServerProcessTermination } from './shutdown-utils';
import { openSockets } from './server';

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
