import {
  AffectedEvent,
  Task,
  TaskCompleteEvent,
  TasksRunner
} from '@nrwl/workspace/src/tasks-runner/tasks-runner';
import { Observable, Subject } from 'rxjs';
import {
  tasksRunnerV2,
  DefaultTasksRunnerOptions,
  RemoteCache
} from '@nrwl/workspace/src/tasks-runner/tasks-runner-v2';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { NxJson } from '@nrwl/workspace/src/core/shared-interfaces';
import { writeFileSync } from 'fs';

const axios = require('axios');
const tar = require('tar');

interface InsightsTaskRunnerOptions extends DefaultTasksRunnerOptions {
  insightsUrl?: string;
}

type Context = {
  projectGraph: ProjectGraph;
  target: string;
  nxJson: NxJson;
};

class InsightsRemoteCache implements RemoteCache {
  constructor(private readonly axiosInstance: any) {}

  async retrieve(hash: string, cacheDirectory: string): Promise<boolean> {
    try {
      const resp = await this.axiosInstance({
        method: 'get',
        url: `/nx-cache/${hash}`,
        maxContentLength: 1000 * 1000 * 50
      });
      const tg = path.join(cacheDirectory, `${hash}.tg`);
      writeFileSync(tg, resp.data, { encoding: 'base64' });
      await tar.x({
        file: tg,
        cwd: cacheDirectory
      });
      writeFileSync(path.join(cacheDirectory, `${hash}.commit`), 'true');
      return true;
    } catch (e) {
      if (e.response && e.response.status === 404) {
        // cache miss. print nothing
      } else if (e.code === 'ECONNREFUSED') {
        console.error(`Error: Cannot cannot to remote cache.`);
      } else {
        console.error(e.message);
      }
      return false;
    }
  }

  async store(hash: string, cacheDirectory: string): Promise<boolean> {
    const tg = path.join(cacheDirectory, `${hash}.tg`);
    try {
      await tar.c(
        {
          gzip: false,
          file: tg,
          cwd: cacheDirectory
        },
        [hash]
      );
      await this.axiosInstance({
        method: 'post',
        url: `/nx-cache/${hash}`,
        data: { tgz: fs.readFileSync(tg).toString('base64') },
        maxContentLength: 1000 * 1000 * 50
      });
      return true;
    } catch (e) {
      if (e.code === 'ECONNREFUSED') {
        console.error(`Error: Cannot cannot to remote cache.`);
      } else {
        console.error(e.message);
      }
      return false;
    }
  }
}

const insightsTaskRunner: TasksRunner<InsightsTaskRunnerOptions> = (
  tasks: Task[],
  options: InsightsTaskRunnerOptions,
  context: Context
): Observable<AffectedEvent> => {
  const res = new Subject<AffectedEvent>();

  const notifier = createNotifier(options, context);
  const remoteCache = createRemoteCache(options);

  let commandResult = true;
  notifier.startCommand(tasks).then(() => {
    tasksRunnerV2(tasks, { ...options, remoteCache }, context).subscribe({
      next: (t: TaskCompleteEvent) => {
        commandResult = commandResult && t.success;
        res.next(t);
        notifier.endTask(t.task.id, stringifyStatus(t.success), '');
      },
      complete: () => {
        notifier.endCommand(stringifyStatus(commandResult)).then(() => {
          printNxInsightsStatus(notifier, commandResult);
          res.complete();
        });
      }
    });
  });

  return res;
};

function createRemoteCache(options: InsightsTaskRunnerOptions) {
  // if (!process.env.NX_INSIGHTS_AUTH_TOKEN) {
  //   return undefined;
  // }
  return new InsightsRemoteCache(createAxios(options));
}

function createNotifier(
  options: InsightsTaskRunnerOptions,
  context: Context
): Notifier {
  if (!process.env.NX_INSIGHTS_AUTH_TOKEN) {
    reportSetupError(`NX_INSIGHTS_AUTH_TOKEN env variable is not set.`);
    return new EmptyNotifier();
  }
  if (
    process.env.NX_INSIGHTS_AUTH_TOKEN &&
    !process.env.NX_INSIGHTS_BRANCH_ID
  ) {
    reportSetupError(`NX_INSIGHTS_BRANCH_ID env variable is not set.`);
    return new EmptyNotifier();
  }
  if (process.env.NX_INSIGHTS_AUTH_TOKEN && !process.env.NX_INSIGHTS_RUN_ID) {
    reportSetupError(`NX_INSIGHTS_RUN_ID env variable is not set.`);
    return new EmptyNotifier();
  }
  return new InsightsNotifier(createAxios(options), context);
}

function createAxios(options: InsightsTaskRunnerOptions) {
  return axios.create({
    baseURL: options.insightsUrl || 'https://nrwl.api.io',
    timeout: 30000,
    headers: { authorization: `auth ${process.env.NX_INSIGHTS_AUTH_TOKEN}` }
  });
}

function reportSetupError(reason: string) {
  console.error(`WARNING: Nx won't send data to Nx Insights.`);
  console.error(`Reason: ${reason}`);
}

function printNxInsightsStatus(
  notifier: EmptyNotifier,
  commandResult: boolean
) {
  if (notifier.errors.length > 0) {
    if (commandResult) {
      console.error(
        `The command succeeded, but we were unable to send the data to Nx Insights:`
      );
    } else {
      console.error(`We were unable to send the data to Nx Insights.`);
    }
    console.error(`Errors:`);
    console.error(notifier.errors[0]);
  }
}

function stringifyStatus(s: boolean) {
  return s ? 'success' : 'failure';
}

interface Notifier {
  errors: string[];

  startCommand(tasks: Task[]): Promise<any>;

  endCommand(result: string): Promise<any>;

  endTask(taskId: string, result: string, log: string): void;
}

class EmptyNotifier implements Notifier {
  errors = [];

  startCommand(tasks: Task[]) {
    return Promise.resolve();
  }

  endCommand(result: string) {
    return Promise.resolve();
  }

  endTask(taskId: string, result: string, log: string) {}
}

class InsightsNotifier implements Notifier {
  errors: string[] = [];
  endTaskNotifications = [];

  commandId: string;

  constructor(
    private readonly axiosInstance: any,
    private readonly context: Context
  ) {
    this.commandId = this.generateCommandId();
  }

  startCommand(tasks: Task[]) {
    const files = this.collectGlobalFiles();
    const p = this.makePostRequest('nx-insights-record-start-command', {
      workspaceId: '---', // should remove it
      runContext: '---', // should remove it
      branchId: this.envOptions.branchId,
      runId: this.envOptions.runId,
      commandId: this.commandId,
      target: this.context.target,
      packageJson: files.packageJson,
      workspaceJson: files.workspaceJson,
      nxJson: files.nxJson,
      projectGraph: JSON.stringify(this.context.projectGraph),
      startTime: new Date().toISOString()
    });
    return p.then(() => tasks.map(t => this.startTask(t)));
  }

  endCommand(result: string): Promise<any> {
    return Promise.all(this.endTaskNotifications).then(() => {
      return this.makePostRequest('nx-insights-record-end-command', {
        commandId: this.commandId,
        endTime: new Date().toISOString(),
        result
      });
    });
  }

  endTask(taskId: string, result: string, log: string) {
    this.endTaskNotifications.push(
      this.makePostRequest('nx-insights-record-end-task', {
        taskId,
        endTime: new Date().toISOString(),
        result,
        log
      })
    );
  }

  private get envOptions() {
    return {
      branchId: process.env.NX_INSIGHTS_BRANCH_ID,
      runId: process.env.NX_INSIGHTS_RUN_ID
    };
  }

  private startTask(task: Task) {
    return this.makePostRequest('nx-insights-record-start-task', {
      commandId: this.commandId,
      taskId: task.id,
      startTime: new Date().toISOString(),
      target: task.target.target,
      projectName: task.target.project
    });
  }

  private collectGlobalFiles() {
    return {
      nxJson: fs.readFileSync('nx.json').toString(),
      workspaceJson: fs.readFileSync('workspace.json').toString(),
      packageJson: fs.readFileSync('package.json').toString()
    };
  }

  private generateCommandId() {
    return `${this.envOptions.runId}-${this.context.target}-${Math.floor(
      Math.random() * 100000
    )}`;
  }

  private makePostRequest(endpoint: string, post: Record<any, any>) {
    return this.axiosInstance.post(endpoint, post).catch(e => {
      this.errors.push(e.message);
    });
  }
}

export default insightsTaskRunner;
