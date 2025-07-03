import { serverLogger } from './logger';

jest.mock('../../utils/versions', () => ({
  ...jest.requireActual('../../utils/versions'),
  nxVersion: 'NX_VERSION',
}));

describe('serverLogger', () => {
  let consoleLogSpy: jest.Spied<typeof console.log>;

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
