import type { Socket } from 'net';

jest.mock('../server', () => ({ handleResult: jest.fn() }));
jest.mock('../project-graph-incremental-recomputation', () => ({
  currentProjectGraph: undefined,
}));

import { handleResult } from '../server';
import {
  notifyFileWatcherSocketsOfError,
  registeredFileWatcherSockets,
  removeRegisteredFileWatcherSocket,
} from './file-watcher-sockets';

const handleResultMock = handleResult as jest.Mock;

function registerSocket(socket: Socket) {
  registeredFileWatcherSockets.push({
    socket,
    config: {
      watchProjects: 'all',
      includeGlobalWorkspaceFiles: false,
      includeDependencies: false,
    },
  });
}

/** The notify helpers dispatch through a queue rather than awaiting inline. */
async function flushQueue() {
  await new Promise((res) => setImmediate(res));
  await new Promise((res) => setImmediate(res));
}

describe('notifyFileWatcherSocketsOfError', () => {
  beforeEach(() => {
    handleResultMock.mockReset();
    for (const { socket } of [...registeredFileWatcherSockets]) {
      removeRegisteredFileWatcherSocket(socket);
    }
  });

  it('pushes the error to every registered socket', async () => {
    const first = {} as Socket;
    const second = {} as Socket;
    registerSocket(first);
    registerSocket(second);

    notifyFileWatcherSocketsOfError(new Error('inotify_add_watch failed'));
    await flushQueue();

    expect(handleResultMock).toHaveBeenCalledTimes(2);
    expect(handleResultMock.mock.calls.map(([socket]) => socket)).toEqual([
      first,
      second,
    ]);
  });

  it('sends a payload the client can distinguish from a change event', async () => {
    registerSocket({} as Socket);

    notifyFileWatcherSocketsOfError(new Error('inotify_add_watch failed'));
    await flushQueue();

    const [, , buildResult] = handleResultMock.mock.calls[0];
    const { response } = await buildResult();

    expect(JSON.parse(response)).toEqual({
      watcherError: 'inotify_add_watch failed',
    });
  });

  it('does nothing when no client is watching', async () => {
    notifyFileWatcherSocketsOfError(new Error('inotify_add_watch failed'));
    await flushQueue();

    expect(handleResultMock).not.toHaveBeenCalled();
  });
});
