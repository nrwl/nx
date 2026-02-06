import { Readable, Writable } from 'stream';
import { daemonStreamTransformer, serverLogger } from './logger';

jest.mock('../utils/versions', () => ({
  ...jest.requireActual('../utils/versions'),
  nxVersion: 'NX_VERSION',
}));

describe('daemonStreamTransformer', () => {
  let mockStream: Writable;
  let writeSpy: jest.SpyInstance;

  beforeEach(() => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2021-10-11T17:18:45.980Z').valueOf());
    mockStream = new Writable({
      write: () => {},
    });
    writeSpy = jest.spyOn(mockStream, 'write');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('write()', () => {
    it('should format a single line and write to output stream', (done) => {
      const transformer = daemonStreamTransformer(mockStream);

      transformer.write('test message', 'utf-8', () => {
        expect(writeSpy).toHaveBeenCalledWith(
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - test message\n'
        );
        done();
      });
    });

    it('should handle multiple lines in a single chunk', (done) => {
      const transformer = daemonStreamTransformer(mockStream);

      transformer.write('line1\nline2\nline3', 'utf-8', () => {
        expect(writeSpy).toHaveBeenCalledTimes(3);
        expect(writeSpy).toHaveBeenNthCalledWith(
          1,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line1\n'
        );
        expect(writeSpy).toHaveBeenNthCalledWith(
          2,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line2\n'
        );
        expect(writeSpy).toHaveBeenNthCalledWith(
          3,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line3\n'
        );
        done();
      });
    });

    it('should filter out empty lines', (done) => {
      const transformer = daemonStreamTransformer(mockStream);

      transformer.write('line1\n\nline2\n\n\nline3', 'utf-8', () => {
        expect(writeSpy).toHaveBeenCalledTimes(3);
        expect(writeSpy).toHaveBeenNthCalledWith(
          1,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line1\n'
        );
        expect(writeSpy).toHaveBeenNthCalledWith(
          2,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line2\n'
        );
        expect(writeSpy).toHaveBeenNthCalledWith(
          3,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line3\n'
        );
        done();
      });
    });

    it('should filter out whitespace-only lines', (done) => {
      const transformer = daemonStreamTransformer(mockStream);

      transformer.write('line1\n   \n\t\nline2', 'utf-8', () => {
        expect(writeSpy).toHaveBeenCalledTimes(2);
        expect(writeSpy).toHaveBeenNthCalledWith(
          1,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line1\n'
        );
        expect(writeSpy).toHaveBeenNthCalledWith(
          2,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line2\n'
        );
        done();
      });
    });

    it('should handle Buffer chunks', (done) => {
      const transformer = daemonStreamTransformer(mockStream);
      const buffer = Buffer.from('buffered message');

      transformer.write(buffer, 'utf-8', () => {
        expect(writeSpy).toHaveBeenCalledWith(
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - buffered message\n'
        );
        done();
      });
    });

    it('should handle empty chunk', (done) => {
      const transformer = daemonStreamTransformer(mockStream);

      transformer.write('', 'utf-8', () => {
        expect(writeSpy).not.toHaveBeenCalled();
        done();
      });
    });

    it('should handle chunk with only whitespace', (done) => {
      const transformer = daemonStreamTransformer(mockStream);

      transformer.write('   \n\t\n  ', 'utf-8', () => {
        expect(writeSpy).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe('pipe() integration', () => {
    it('should work correctly when piped from a Readable stream', (done) => {
      const transformer = daemonStreamTransformer(mockStream);
      const readable = Readable.from(['line1\n', 'line2\n', 'line3\n']);

      readable.pipe(transformer);

      setTimeout(() => {
        expect(writeSpy).toHaveBeenCalledTimes(3);
        expect(writeSpy).toHaveBeenNthCalledWith(
          1,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line1\n'
        );
        expect(writeSpy).toHaveBeenNthCalledWith(
          2,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line2\n'
        );
        expect(writeSpy).toHaveBeenNthCalledWith(
          3,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line3\n'
        );
        done();
      }, 100);
    });

    it('should handle split lines across multiple chunks when piped', (done) => {
      const transformer = daemonStreamTransformer(mockStream);
      const readable = Readable.from([
        'line1',
        ' part1\nline2\nline',
        '3 part2\n',
      ]);

      readable.pipe(transformer);

      setTimeout(() => {
        expect(writeSpy).toHaveBeenCalledTimes(3);
        expect(writeSpy).toHaveBeenNthCalledWith(
          1,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line1 part1\n'
        );
        expect(writeSpy).toHaveBeenNthCalledWith(
          2,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line2\n'
        );
        expect(writeSpy).toHaveBeenNthCalledWith(
          3,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line3 part2\n'
        );
        done();
      }, 100);
    });

    it('should handle backpressure properly', (done) => {
      let writeCount = 0;
      const slowStream = new Writable({
        write: (chunk, encoding, callback) => {
          setTimeout(() => {
            writeCount++;
            callback();
          }, 10);
        },
      });

      const transformer = daemonStreamTransformer(slowStream);
      const readable = Readable.from(['line1\n', 'line2\n', 'line3\n']);

      readable.pipe(transformer);

      setTimeout(() => {
        expect(writeCount).toBe(3);
        done();
      }, 200);
    });

    it('should handle split lines across multiple chunks when piped', (done) => {
      const transformer = daemonStreamTransformer(mockStream);
      const readable = Readable.from([
        'line1',
        ' part1\nline2\nline',
        '3 part2\n',
      ]);

      readable.pipe(transformer);

      setTimeout(() => {
        expect(writeSpy).toHaveBeenCalledTimes(3);
        expect(writeSpy).toHaveBeenNthCalledWith(
          1,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line1 part1\n'
        );
        expect(writeSpy).toHaveBeenNthCalledWith(
          2,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line2\n'
        );
        expect(writeSpy).toHaveBeenNthCalledWith(
          3,
          '[NX vNX_VERSION Daemon] - 2021-10-11T17:18:45.980Z - line3 part2\n'
        );
        done();
      }, 100);
    });

    it('should handle backpressure properly', (done) => {
      let writeCount = 0;
      const slowStream = new Writable({
        write: (chunk, encoding, callback) => {
          setTimeout(() => {
            writeCount++;
            callback();
          }, 10);
        },
      });

      const transformer = daemonStreamTransformer(slowStream);
      const readable = Readable.from(['line1\n', 'line2\n', 'line3\n']);

      readable.pipe(transformer);

      setTimeout(() => {
        expect(writeCount).toBe(3);
        done();
      }, 200);
    });

    it('should handle pipe errors gracefully', (done) => {
      const errorStream = new Writable({
        write: (chunk, encoding, callback) => {
          callback(new Error('Write failed'));
        },
      });

      const transformer = daemonStreamTransformer(errorStream);
      const readable = Readable.from(['line1\n']);

      readable.on('end', () => {
        done();
      });
    });
  });
});

describe('serverLogger', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest
      .spyOn(global.Date, 'now')
      .mockImplementation(() => new Date('2021-10-11T17:18:45.980Z').valueOf());
    consoleLogSpy = jest.spyOn(console, 'log');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('log()', () => {
    const testCases = [
      {
        inputs: ['foobar'],
        expectedLog:
          '[NX vNX_VERSION Daemon Server] - 2021-10-11T17:18:45.980Z - foobar',
      },
      {
        inputs: ['foo', 'bar'],
        expectedLog:
          '[NX vNX_VERSION Daemon Server] - 2021-10-11T17:18:45.980Z - foo bar',
      },
      {
        inputs: [1, 2],
        expectedLog:
          '[NX vNX_VERSION Daemon Server] - 2021-10-11T17:18:45.980Z - 1 2',
      },
      {
        inputs: [{ some: 'object' }, ['an', 'array']],
        expectedLog:
          '[NX vNX_VERSION Daemon Server] - 2021-10-11T17:18:45.980Z - {"some":"object"} ["an","array"]',
      },
    ];

    testCases.forEach((tc, i) => {
      it('should pretty print the given message(s) to stdout, wrapping them with useful metadata, CASE: ${i + 1}', () => {
        serverLogger.log(...tc.inputs);
        expect(consoleLogSpy).toHaveBeenCalledWith(tc.expectedLog);
      });
    });
  });

  describe('requestLog() watcherLog() and nestedLog()', () => {
    it('should pretty print the various server log styles', () => {
      serverLogger.log('Server started');
      serverLogger.watcherLog('Watching started');
      serverLogger.requestLog('A request has come in');
      serverLogger.watcherLog('Watching stopped');
      serverLogger.log('Server stopped');
      // prettier-ignore
      expect(consoleLogSpy.mock.calls).toEqual([
        ['[NX vNX_VERSION Daemon Server] - 2021-10-11T17:18:45.980Z - Server started'],
        ['[NX vNX_VERSION Daemon Server] - 2021-10-11T17:18:45.980Z - [WATCHER]: Watching started'],
        ['[NX vNX_VERSION Daemon Server] - 2021-10-11T17:18:45.980Z - [REQUEST]: A request has come in'],
        ['[NX vNX_VERSION Daemon Server] - 2021-10-11T17:18:45.980Z - [WATCHER]: Watching stopped'],
        ['[NX vNX_VERSION Daemon Server] - 2021-10-11T17:18:45.980Z - Server stopped'],
      ]);
    });
  });
});
