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
    if (!this.logs.has(executorName)) {
      this.logs.set(executorName, new Map());
    }

    const executorLogs = this.logs.get(executorName);
    if (!executorLogs.has(log)) {
      executorLogs.set(log, { log, projects: new Set([project]) });
    } else {
      const logItem = executorLogs.get(log);
      logItem.projects.add(project);
    }
  }

  reset(): void {
    this.logs.clear();
  }

  flushLogs(): void {
    let fullLog = '';
    for (const executorName of this.logs.keys()) {
      fullLog = `${fullLog}${output.bold(
        `Encountered the following while migrating '${executorName}':\r\n`
      )}`;
      for (const logItem of this.logs.get(executorName).values()) {
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
