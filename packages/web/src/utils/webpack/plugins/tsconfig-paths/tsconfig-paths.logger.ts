import { Console } from 'console';
import { Chalk } from 'chalk';
import { Options } from './tsconfig-paths.options';

// tslint:disable-next-line:no-any
type InternalLoggerFunc = (whereToLog: any, message: string) => void;

export type LoggerFunc = (message: string) => void;

export interface Logger {
  log: LoggerFunc;
  logInfo: LoggerFunc;
  logWarning: LoggerFunc;
  logError: LoggerFunc;
}

enum LogLevel {
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const stderrConsole = new Console(process.stderr);
const stdoutConsole = new Console(process.stdout);

const doNothingLogger = (_message: string) => {
  /* Do nothing */
};

const makeLoggerFunc = (options: Options): InternalLoggerFunc =>
  options.silent
    ? (_whereToLog: Console, _message: string) => {
        /* Do nothing */
      }
    : (whereToLog: Console, message: string) => whereToLog.log(message);

const makeExternalLogger =
  (loaderOptions: Options, logger: InternalLoggerFunc) => (message: string) =>
    logger(
      loaderOptions.logInfoToStdOut ? stdoutConsole : stderrConsole,
      message
    );

const makeLogInfo = (
  options: Options,
  logger: InternalLoggerFunc,
  green: Chalk
) =>
  LogLevel[options.logLevel] <= LogLevel.INFO
    ? (message: string) =>
        logger(
          options.logInfoToStdOut ? stdoutConsole : stderrConsole,
          green(message)
        )
    : doNothingLogger;

const makeLogError = (
  options: Options,
  logger: InternalLoggerFunc,
  red: Chalk
) =>
  LogLevel[options.logLevel] <= LogLevel.ERROR
    ? (message: string) => logger(stderrConsole, red(message))
    : doNothingLogger;

const makeLogWarning = (
  options: Options,
  logger: InternalLoggerFunc,
  yellow: Chalk
) =>
  LogLevel[options.logLevel] <= LogLevel.WARN
    ? (message: string) => logger(stderrConsole, yellow(message))
    : doNothingLogger;

export function makeLogger(options: Options, colors: Chalk): Logger {
  const logger = makeLoggerFunc(options);
  return {
    log: makeExternalLogger(options, logger),
    logInfo: makeLogInfo(options, logger, colors.green),
    logWarning: makeLogWarning(options, logger, colors.yellow),
    logError: makeLogError(options, logger, colors.red),
  };
}
