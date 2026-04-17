import { DaemonClient } from './client';
import { VersionMismatchError } from './daemon-socket-messenger';

declare global {
  // eslint-disable-next-line no-var
  var NX_PLUGIN_WORKER: boolean | undefined;
}

// Mirrors the private enum in client.ts for test assertions.
const enum DaemonStatus {
  CONNECTING = 0,
  DISCONNECTED = 1,
  CONNECTED = 2,
}

type TestClient = {
  _daemonStatus: DaemonStatus;
  _waitForDaemonReady: Promise<void> | null;
  _daemonReady: (() => void) | null;
  currentMessage: unknown;
  currentResolve: ((v: unknown) => void) | null;
  currentReject: ((e: unknown) => void) | null;
  startDaemonIfNecessary: () => Promise<void>;
  handleConnectionError: (err: Error) => Promise<void>;
  isServerAvailable: () => Promise<boolean>;
  startInBackground: () => Promise<number>;
  setUpConnection: () => void;
  waitForServerToBeAvailable: (opts: {
    ignoreVersionMismatch: boolean;
  }) => Promise<boolean>;
  establishConnection: () => void;
  registerDaemonProcessWithMetricsService: (
    pid: number | null
  ) => Promise<void>;
};

function asTest(client: DaemonClient): TestClient {
  return client as unknown as TestClient;
}

describe('DaemonClient state machine', () => {
  let client: TestClient;

  beforeEach(() => {
    client = asTest(new DaemonClient());
    // Never actually register with metrics during tests.
    jest
      .spyOn(
        client as unknown as { registerDaemonProcessWithMetricsService: any },
        'registerDaemonProcessWithMetricsService'
      )
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete global.NX_PLUGIN_WORKER;
    jest.restoreAllMocks();
  });

  describe('startDaemonIfNecessary()', () => {
    it('does not wedge concurrent callers when the initial connect throws', async () => {
      const err = new Error('spawn failed');
      jest.spyOn(client, 'isServerAvailable').mockResolvedValue(false);
      jest.spyOn(client, 'startInBackground').mockRejectedValue(err);

      // Kick off caller A synchronously; it flips status DISCONNECTED -> CONNECTING.
      const first = client.startDaemonIfNecessary();
      // Caller B now enters the CONNECTING branch and awaits _waitForDaemonReady.
      const second = client.startDaemonIfNecessary();

      await expect(first).rejects.toThrow('spawn failed');
      await expect(second).rejects.toThrow('spawn failed');

      // A failed attempt must leave the client DISCONNECTED so the next
      // caller can retry instead of parking on a pending promise forever.
      expect(client._daemonStatus).toBe(DaemonStatus.DISCONNECTED);
    });

    it('lets a future caller retry after a failed connect attempt', async () => {
      const err = new Error('spawn failed');
      const isServerAvailable = jest
        .spyOn(client, 'isServerAvailable')
        .mockResolvedValue(false);
      const startInBackground = jest
        .spyOn(client, 'startInBackground')
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce(1234);
      jest.spyOn(client, 'setUpConnection').mockImplementation(() => {
        /* no-op */
      });

      await expect(client.startDaemonIfNecessary()).rejects.toThrow(
        'spawn failed'
      );
      expect(client._daemonStatus).toBe(DaemonStatus.DISCONNECTED);

      await expect(client.startDaemonIfNecessary()).resolves.toBeUndefined();
      expect(client._daemonStatus).toBe(DaemonStatus.CONNECTED);
      expect(isServerAvailable).toHaveBeenCalledTimes(2);
      expect(startInBackground).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleConnectionError() inside a plugin worker', () => {
    beforeEach(() => {
      global.NX_PLUGIN_WORKER = true;
    });

    it('does not attempt reconnection', async () => {
      const waitSpy = jest
        .spyOn(client, 'waitForServerToBeAvailable')
        .mockResolvedValue(true);
      const currentReject = jest.fn();
      client.currentReject = currentReject;

      await client.handleConnectionError(new Error('daemon gone'));

      expect(waitSpy).not.toHaveBeenCalled();
      expect(currentReject).toHaveBeenCalledTimes(1);
      const rejectedError = currentReject.mock.calls[0][0] as Error;
      expect(rejectedError.message).toMatch(/plugin worker/i);
    });

    it('unblocks concurrent callers parked on _waitForDaemonReady', async () => {
      // Capture the ready promise that was created in reset().
      const pendingReady = client._waitForDaemonReady!;
      client.currentReject = jest.fn();

      await client.handleConnectionError(new Error('daemon gone'));

      // The promise concurrent callers were awaiting must not be left
      // hanging — it must surface the plugin-worker error.
      await expect(pendingReady).rejects.toThrow(/plugin worker/i);
      expect(client._daemonStatus).toBe(DaemonStatus.DISCONNECTED);
    });
  });

  describe('handleConnectionError() with a version mismatch on reconnect', () => {
    it('surfaces the error to concurrent callers awaiting _waitForDaemonReady', async () => {
      jest
        .spyOn(client, 'waitForServerToBeAvailable')
        .mockRejectedValue(new VersionMismatchError());
      const currentReject = jest.fn();
      client.currentReject = currentReject;

      // Drive handleConnectionError; it will create a new _waitForDaemonReady
      // and replace the existing reference. Grab that new one after the fact.
      const settle = client.handleConnectionError(new Error('daemon gone'));
      // Wait for it to create the new promise; handleConnectionError is
      // synchronous up to the first await.
      const newReady = client._waitForDaemonReady!;

      await settle;

      await expect(newReady).rejects.toBeInstanceOf(VersionMismatchError);
      expect(client._daemonStatus).toBe(DaemonStatus.DISCONNECTED);
      expect(currentReject).toHaveBeenCalledWith(
        expect.any(VersionMismatchError)
      );
    });
  });
});
