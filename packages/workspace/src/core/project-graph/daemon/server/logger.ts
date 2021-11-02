/**
 * To improve the overall readibility of the logs, we categorize things by "trigger":
 *
 * - [REQUEST] meaning that the current set of actions were triggered by a client request to the server
 * - [WATCHER] meaning the the current set of actions were triggered by handling changes to the workspace files
 *
 * We keep those two "triggers" left aligned at the top level and then indent subsequent logs so that there is a
 * logical hierarchy/grouping.
 */

class ServerLogger {
  log(...s: unknown[]) {
    console.log(
      this.formatLogMessage(
        `${s
          .map((val) => {
            if (typeof val === 'string') {
              return val;
            }
            return JSON.stringify(val);
          })
          .join(' ')}`
      )
    );
  }

  requestLog(...s: unknown[]) {
    this.log(`[REQUEST]: ${s.join(' ')}`);
  }

  watcherLog(...s: unknown[]) {
    this.log(`[WATCHER]: ${s.join(' ')}`);
  }

  nestedLog(...s: unknown[]) {
    this.log(`  ${s.join(' ')}`);
  }

  private formatLogMessage(message: string) {
    return `[NX Daemon Server] - ${this.getNow()} - ${message}`;
  }

  private getNow() {
    return new Date(Date.now()).toISOString();
  }
}

export const serverLogger = new ServerLogger();
