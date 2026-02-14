import { createLogger, NX_PREFIX, NX_ERROR } from './logger';
import * as pc from 'picocolors';

describe('createLogger', () => {
  let mockDriver: {
    warn: jest.Mock;
    error: jest.Mock;
    info: jest.Mock;
    log: jest.Mock;
    debug: jest.Mock;
  };

  beforeEach(() => {
    mockDriver = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
    };
  });

  describe('warn', () => {
    it('should output message in bold yellow', () => {
      const logger = createLogger(mockDriver);
      logger.warn('warning message');

      expect(mockDriver.warn).toHaveBeenCalledWith(
        pc.bold(pc.yellow('warning message'))
      );
    });
  });

  describe('error', () => {
    it('should format string starting with "NX " with NX_ERROR prefix', () => {
      const logger = createLogger(mockDriver);
      logger.error('NX some error');

      expect(mockDriver.error).toHaveBeenCalledWith(
        `\n${NX_ERROR} ${pc.bold(pc.red('some error'))}\n`
      );
    });

    it('should format Error objects with stack trace in bold red', () => {
      const logger = createLogger(mockDriver);
      const error = new Error('test error');
      error.stack = 'Error: test error\n    at Test.fn';
      logger.error(error);

      expect(mockDriver.error).toHaveBeenCalledWith(
        pc.bold(pc.red('Error: test error\n    at Test.fn'))
      );
    });

    it('should format plain strings in bold red', () => {
      const logger = createLogger(mockDriver);
      logger.error('plain error');

      expect(mockDriver.error).toHaveBeenCalledWith(
        pc.bold(pc.red('plain error'))
      );
    });
  });

  describe('info', () => {
    it('should format string starting with "NX " with NX_PREFIX', () => {
      const logger = createLogger(mockDriver);
      logger.info('NX some info');

      expect(mockDriver.info).toHaveBeenCalledWith(
        `\n${NX_PREFIX} ${pc.bold('some info')}\n`
      );
    });

    it('should pass through non-NX prefixed messages unchanged', () => {
      const logger = createLogger(mockDriver);
      logger.info('regular info');

      expect(mockDriver.info).toHaveBeenCalledWith('regular info');
    });
  });

  describe('log', () => {
    it('should pass through arguments to driver.log', () => {
      const logger = createLogger(mockDriver);
      logger.log('message1', 'message2', { key: 'value' });

      expect(mockDriver.log).toHaveBeenCalledWith('message1', 'message2', {
        key: 'value',
      });
    });
  });

  describe('debug', () => {
    it('should pass through arguments to driver.debug', () => {
      const logger = createLogger(mockDriver);
      logger.debug('debug1', 'debug2');

      expect(mockDriver.debug).toHaveBeenCalledWith('debug1', 'debug2');
    });
  });

  describe('fatal', () => {
    it('should pass through arguments to driver.error', () => {
      const logger = createLogger(mockDriver);
      logger.fatal('fatal error', { details: 'info' });

      expect(mockDriver.error).toHaveBeenCalledWith('fatal error', {
        details: 'info',
      });
    });
  });

  describe('verbose', () => {
    const originalEnv = process.env.NX_VERBOSE_LOGGING;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.NX_VERBOSE_LOGGING;
      } else {
        process.env.NX_VERBOSE_LOGGING = originalEnv;
      }
    });

    it('should output to driver.warn when NX_VERBOSE_LOGGING is true', () => {
      process.env.NX_VERBOSE_LOGGING = 'true';
      const logger = createLogger(mockDriver);
      logger.verbose('verbose message', { extra: 'data' });

      expect(mockDriver.warn).toHaveBeenCalledWith('verbose message', {
        extra: 'data',
      });
    });

    it('should not output anything when NX_VERBOSE_LOGGING is not set', () => {
      delete process.env.NX_VERBOSE_LOGGING;
      const logger = createLogger(mockDriver);
      logger.verbose('verbose message');

      expect(mockDriver.warn).not.toHaveBeenCalled();
    });

    it('should not output anything when NX_VERBOSE_LOGGING is false', () => {
      process.env.NX_VERBOSE_LOGGING = 'false';
      const logger = createLogger(mockDriver);
      logger.verbose('verbose message');

      expect(mockDriver.warn).not.toHaveBeenCalled();
    });
  });
});
