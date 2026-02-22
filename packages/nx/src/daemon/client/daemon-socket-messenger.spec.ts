import { DaemonSocketMessenger } from './daemon-socket-messenger';
import { EventEmitter } from 'events';

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

describe('DaemonSocketMessenger', () => {
  describe('listen()', () => {
    it('should destroy the socket on timeout event', () => {
      const socket = new MockSocket() as any;
      const messenger = new DaemonSocketMessenger(socket);

      const onError = jest.fn();
      const onClose = jest.fn();

      messenger.listen(() => {}, onClose, onError);

      // Simulate timeout event
      socket.emit('timeout');

      expect(socket.destroyed).toBe(true);
      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toContain(
        'Socket timed out communicating with Nx Daemon'
      );
      expect(onClose).toHaveBeenCalled();
    });

    it('should transition to message exchange timeout after connect', () => {
      const socket = new MockSocket() as any;
      const messenger = new DaemonSocketMessenger(socket);

      // Simulate initial connect-phase timeout set by setUpConnection
      socket.setTimeout(30_000);
      expect(socket._timeout).toBe(30_000);

      messenger.listen(() => {});

      // Simulate successful connection
      socket.emit('connect');

      // Should transition to 5-minute message exchange timeout
      expect(socket._timeout).toBe(5 * 60 * 1000);
    });

    it('should propagate socket errors to onError callback', () => {
      const socket = new MockSocket() as any;
      const messenger = new DaemonSocketMessenger(socket);

      const onError = jest.fn();
      messenger.listen(
        () => {},
        () => {},
        onError
      );

      const error = new Error('connection refused');
      socket.emit('error', error);

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should call onClose when socket closes', () => {
      const socket = new MockSocket() as any;
      const messenger = new DaemonSocketMessenger(socket);

      const onClose = jest.fn();
      messenger.listen(() => {}, onClose);

      socket.emit('close');

      expect(onClose).toHaveBeenCalled();
    });

    it('should keep aggressive connect timeout until connection is established', () => {
      const socket = new MockSocket() as any;
      const messenger = new DaemonSocketMessenger(socket);

      // Simulate initial connect-phase timeout
      socket.setTimeout(30_000);

      messenger.listen(() => {});

      // Before connect event, timeout should remain at connect-phase value
      expect(socket._timeout).toBe(30_000);
    });
  });

  describe('close()', () => {
    it('should destroy the socket', () => {
      const socket = new MockSocket() as any;
      const messenger = new DaemonSocketMessenger(socket);

      messenger.close();

      expect(socket.destroyed).toBe(true);
    });
  });
});
