import { output, logger } from 'nx/src/devkit-exports';

interface AggregateLogOptions {
  project: string;
  log: string;
  executorName: string;
}

interface AggregateLogItem {
  log: string;
  projects: Set<string>;
}

/**
 * @example
 * // Instantiate a new object
 * const migrationLogs = new AggregatedLog();
 *
 * // Add logs
 * migrationLogs.addLog({executorName: '@nx/vite:build', project: 'app1', log: 'Migrate X manually'});
 *
 * // Flush all logs
 * migrationLogs.flushLogs()
 */
export class AggregatedLog {
  logs: Map<string, Map<string, AggregateLogItem>> = new Map();

  addLog({ project, log, executorName }: AggregateLogOptions): void {
    let executorLogs = this.logs.get(executorName);
    if (!executorLogs) {
      executorLogs = new Map();
      this.logs.set(executorName, executorLogs);
    }

    const logItem = executorLogs.get(log);
    if (!logItem) {
      executorLogs.set(log, { log, projects: new Set([project]) });
    } else {
      logItem.projects.add(project);
    }
  }

  reset(): void {
    this.logs.clear();
  }

  flushLogs(): void {
    if (this.logs.size === 0) {
      return;
    }

    let fullLog = '';
    for (const [executorName, executorLogs] of this.logs) {
      fullLog = `${fullLog}${output.bold(
        `Encountered the following while migrating '${executorName}':\r\n`
      )}`;
      for (const logItem of executorLogs.values()) {
        fullLog = `${fullLog}   • ${logItem.log}\r\n`;
        fullLog = `${fullLog}     ${output.bold(`Affected Projects`)}\r\n`;
        fullLog = `${fullLog}      ${Array.from(logItem.projects.values()).join(
          `\r\n      `
        )}`;
        fullLog = `${fullLog}\r\n`;
      }
    }

    logger.warn(fullLog);

    this.reset();
  }
}
