import { Cache, TaskWithCachedResult } from './cache';
import { cliCommand } from '../core/file-utils';
import { NxJson } from '../core/shared-interfaces';
import { ProjectGraph } from '../core/project-graph';
import { AffectedEventType, Task } from './tasks-runner';
import { getCommand, getOutputs } from './utils';
import { basename } from 'path';
import { spawn } from 'child_process';
import { DefaultTasksRunnerOptions } from './tasks-runner-v2';
import { output } from '../utils/output';

export class TaskOrchestrator {
  cache = new Cache(this.projectGraph, this.nxJson, this.options);
  cli = cliCommand();
  isYarn = basename(process.env.npm_execpath || 'npm').startsWith('yarn');

  constructor(
    private readonly nxJson: NxJson,
    private readonly projectGraph: ProjectGraph,
    private readonly options: DefaultTasksRunnerOptions
  ) {}

  async run(tasksInStage: Task[]) {
    const { cached, rest } = await this.splitTasksIntoCachedAndNotCached(
      tasksInStage
    );

    const r1 = await this.applyCachedResults(cached);
    const r2 = await this.runRest(rest);
    return [...r1, ...r2];
  }

  private async runRest(tasks: Task[]) {
    const left = [...tasks];
    const res = [];

    const that = this;

    function takeFromQueue() {
      if (left.length > 0) {
        const task = left.pop();
        return that
          .spawnProcess(task)
          .then(code => {
            res.push({
              task,
              success: code === 0,
              type: AffectedEventType.TaskComplete
            });
          })
          .then(takeFromQueue)
          .catch(takeFromQueue);
      } else {
        return Promise.resolve(null);
      }
    }

    const wait = [];
    // initial seeding
    const maxParallel = this.options.parallel
      ? this.options.maxParallel || 3
      : 1;
    for (let i = 0; i < maxParallel; ++i) {
      wait.push(takeFromQueue());
    }
    await Promise.all(wait);
    return res;
  }

  private async splitTasksIntoCachedAndNotCached(
    tasks: Task[]
  ): Promise<{ cached: TaskWithCachedResult[]; rest: Task[] }> {
    const cached: TaskWithCachedResult[] = [];
    const rest: Task[] = [];
    await Promise.all(
      tasks.map(async task => {
        const cachedResult = await this.cache.get(task);
        if (cachedResult) {
          cached.push({ task, cachedResult });
        } else {
          rest.push(task);
        }
      })
    );
    return { cached, rest };
  }

  private applyCachedResults(tasks: TaskWithCachedResult[]) {
    tasks.forEach(t => {
      output.note({ title: `Cached Output:` });
      process.stdout.write(t.cachedResult.terminalOutput);
      const outputs = getOutputs(this.projectGraph.nodes, t.task);
      this.cache.copyFilesFromCache(t.cachedResult, outputs);
    });

    return tasks.reduce((m, c) => {
      m.push({
        task: c.task,
        type: AffectedEventType.TaskCacheRead,
        success: true
      });
      return m;
    }, []);
  }

  private spawnProcess(task: Task) {
    const taskOutputs = getOutputs(this.projectGraph.nodes, task);
    return new Promise(res => {
      const command = this.isYarn ? 'yarn' : 'npm';
      const commandArgs = this.isYarn
        ? getCommand(this.cli, this.isYarn, task)
        : ['run', ...getCommand(this.cli, this.isYarn, task)];
      const p = spawn(command, commandArgs, {
        stdio: [process.stdin, 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: 'true' }
      });

      let out = [];

      p.stdout.on('data', data => {
        out.push(data);
        process.stdout.write(data);
      });

      p.stderr.on('data', data => {
        out.push(data);
        process.stderr.write(data);
      });

      p.on('close', code => {
        if (code === 0) {
          this.cache.put(task, out.join(''), taskOutputs).then(() => {
            res(code);
          });
        } else {
          res(code);
        }
      });
    });
  }
}
