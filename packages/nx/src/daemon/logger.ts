/**
 * Unified logger for daemon server and client.
 *
 * To improve the overall readability of the logs, we categorize things by "trigger":
 *
 * - [REQUEST] meaning that the current set of actions were triggered by a client request to the server
 * - [WATCHER] meaning the current set of actions were triggered by handling changes to the workspace files
 *
 * We keep those two "triggers" left aligned at the top level and then indent subsequent logs so that there is a
 * logical hierarchy/grouping.
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import {
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  DAEMON_OUTPUT_LOG_FILE,
} from './tmp-dir';
import { nxVersion } from '../utils/versions';
import { ProgressTopic } from '../utils/progress-topics';
import { EMIT_LOG, EmitLogLevel } from './message-types/streaming-messages';
import {
  assertOnDaemon,
  getTopicSubscribers,
  writeStreamingMessage,
} from './server/client-socket-context';

type LogSource = 'Server' | 'Client';

class DaemonLogger {
  constructor(private source: LogSource) {}

  log(...s: unknown[]) {
    const message = this.formatLogMessage(
      s
        .map((val) => {
          if (typeof val === 'string') {
            return val;
          }
          return JSON.stringify(val);
        })
        .join(' ')
    );

    if (this.source === 'Server') {
      // Server's stdout is redirected to daemon.log
      console.log(message);
    } else {
      // Client writes directly to the log file
      this.writeToFile(message);
    }
  }

  requestLog(...s: unknown[]) {
    this.log(`[REQUEST]: ${s.join(' ')}`);
  }

  watcherLog(...s: unknown[]) {
    this.log(`[WATCHER]: ${s.join(' ')}`);
  }

  /**
   * Broadcasts a log line to every client currently subscribed to the
   * given topic. Useful for warnings raised inside daemon-executed code
   * that we want the user to see in their terminal rather than lose to
   * the daemon log file.
   *
   * Falls back to writing into the daemon log when no clients are
   * subscribed to the topic.
   *
   * Must only be invoked from inside the Nx daemon process.
   */
  logToClient(topic: ProgressTopic, level: EmitLogLevel, message: string) {
    assertOnDaemon('DaemonLogger#logToClient');
    const subscribers = getTopicSubscribers(topic);
    if (!subscribers?.size) {
      this.log(`[emit-log:${level}] ${message}`);
      return;
    }
    const payload = { type: EMIT_LOG, level, message };
    for (const socket of subscribers) {
      writeStreamingMessage(socket, payload);
    }
  }

  private writeToFile(message: string) {
    try {
      if (!existsSync(DAEMON_DIR_FOR_CURRENT_WORKSPACE)) {
        mkdirSync(DAEMON_DIR_FOR_CURRENT_WORKSPACE, { recursive: true });
      }
      appendFileSync(DAEMON_OUTPUT_LOG_FILE, message + '\n');
    } catch {
      // Ignore write errors
    }
  }

  private formatLogMessage(message: string) {
    return `[NX v${nxVersion} Daemon ${
      this.source
    }] - ${this.getNow()} - ${message}`;
  }

  private getNow() {
    return new Date(Date.now()).toISOString();
  }
}

export const serverLogger = new DaemonLogger('Server');
export const clientLogger = new DaemonLogger('Client');
