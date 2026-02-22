import { EventEmitter } from 'events';

// Mock socket implementation for testing timeout behavior
class MockSocket extends EventEmitter {
  destroyed = false;
  _timeout = 0;

  setTimeout(ms: number) {
    this._timeout = ms;
  }

  destroy(err?: Error) {
    if (this.destroyed) return;
    this.destroyed = true;
    if (err) {
      this.emit('error', err);
    }
    this.emit('close');
  }

  write(_data: any) {}
}

let mockSocket: MockSocket;
let connectCallback: (() => void) | undefined;

jest.mock('net', () => ({
  connect: jest.fn((_path: string, cb?: () => void) => {
    mockSocket = new MockSocket();
    connectCallback = cb;
    return mockSocket;
  }),
}));

jest.mock('../../config/configuration', () => ({
  readNxJson: jest.fn(() => null),
}));

jest.mock('../tmp-dir', () => ({
  DAEMON_DIR_FOR_CURRENT_WORKSPACE: '/tmp/test-daemon',
  DAEMON_OUTPUT_LOG_FILE: '/tmp/test-daemon/log',
  isDaemonDisabled: jest.fn(() => false),
  removeSocketDir: jest.fn(),
  socketDir: '/tmp/test-socket',
}));

jest.mock('../cache', () => ({
  readDaemonProcessJsonCache: jest.fn(() => ({
    socketPath: '/tmp/test-daemon.sock',
  })),
  getDaemonProcessIdSync: jest.fn(() => 1234),
}));

jest.mock('../../utils/output', () => ({
  output: {
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('../../native', () => ({
  IS_WASM: false,
}));

describe('DaemonClient', () => {
  let DaemonClient: any;

  beforeEach(() => {
    connectCallback = undefined;
    const clientModule = require('./client');
    DaemonClient = clientModule.DaemonClient;
  });

  describe('isServerAvailable', () => {
    it('should return false when socket times out', async () => {
      const client = new DaemonClient();

      const availablePromise = client.isServerAvailable();

      // Don't invoke connectCallback — simulate an unresponsive daemon.
      // Instead, fire the timeout event.
      mockSocket.emit('timeout');

      const result = await availablePromise;

      expect(result).toBe(false);
      expect(mockSocket.destroyed).toBe(true);
    });

    it('should set a socket timeout when checking availability', async () => {
      const client = new DaemonClient();

      const availablePromise = client.isServerAvailable();

      // The socket should have a timeout set (30 seconds)
      expect(mockSocket._timeout).toBe(30_000);

      // Clean up — simulate error to resolve the promise
      mockSocket.emit('error', new Error('test cleanup'));

      await availablePromise;
    });

    it('should return true when socket connects successfully', async () => {
      const client = new DaemonClient();

      const availablePromise = client.isServerAvailable();

      // Simulate successful connection by invoking the connect callback
      connectCallback?.();

      const result = await availablePromise;
      expect(result).toBe(true);
    });

    it('should return false when socket emits error', async () => {
      const client = new DaemonClient();

      const availablePromise = client.isServerAvailable();

      // Don't invoke connectCallback — simulate a connection error.
      mockSocket.emit('error', new Error('ECONNREFUSED'));

      const result = await availablePromise;
      expect(result).toBe(false);
    });
  });
});
