import {
  installGeneratorOutputCapture,
  withGeneratorOutputCapture,
} from './capture-generator-output';

describe('generator output capture', () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  afterEach(() => {
    jest.restoreAllMocks();
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    console.info = originalInfo;
    console.debug = originalDebug;
  });

  describe('installGeneratorOutputCapture', () => {
    it('captures console.log/warn/error/info/debug while still writing to the original methods', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
      const debugSpy = jest
        .spyOn(console, 'debug')
        .mockImplementation(() => {});

      const capture = installGeneratorOutputCapture();
      console.log('a');
      console.warn('b');
      console.error('c');
      console.info('d');
      console.debug('e');
      const captured = capture.flush();
      capture.restore();

      expect(captured.split('\n')).toEqual(['a', 'b', 'c', 'd', 'e']);
      expect(logSpy).toHaveBeenCalledWith('a');
      expect(warnSpy).toHaveBeenCalledWith('b');
      expect(errorSpy).toHaveBeenCalledWith('c');
      expect(infoSpy).toHaveBeenCalledWith('d');
      expect(debugSpy).toHaveBeenCalledWith('e');
    });

    it('formats multi-arg and non-string values like console would', () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});

      const capture = installGeneratorOutputCapture();
      console.log('count =', 3);
      console.log({ a: 1, b: 'two' });
      const captured = capture.flush();
      capture.restore();

      expect(captured).toContain('count = 3');
      expect(captured).toContain("{ a: 1, b: 'two' }");
    });

    it('restores the original methods', () => {
      const capture = installGeneratorOutputCapture();
      expect(console.log).not.toBe(originalLog);
      capture.restore();
      expect(console.log).toBe(originalLog);
    });

    it('restore is idempotent', () => {
      const capture = installGeneratorOutputCapture();
      capture.restore();
      capture.restore();
      expect(console.log).toBe(originalLog);
    });
  });

  describe('withGeneratorOutputCapture', () => {
    it('returns the function result and the captured logs', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});

      const { result, logs } = await withGeneratorOutputCapture(async () => {
        console.log('inside');
        return 42;
      });

      expect(result).toBe(42);
      expect(logs).toContain('inside');
    });

    it('restores the console on throw', async () => {
      const before = console.log;

      await expect(
        withGeneratorOutputCapture(() => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');

      expect(console.log).toBe(before);
    });
  });
});
