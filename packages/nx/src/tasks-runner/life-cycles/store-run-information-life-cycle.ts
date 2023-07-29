import { parse, join } from 'path';
import { writeFileSync } from 'fs';
import { LifeCycle } from '../../tasks-runner/life-cycle';
import { Task } from '../../config/task-graph';
import { TaskStatus } from '../../tasks-runner/tasks-runner';
import { cacheDir } from '../../utils/cache-directory';

export class StoreRunInformationLifeCycle implements LifeCycle {
  private startTime: string;

  private timings: {
    [target: string]: {
      start: string;
      end: string;
    };
  } = {};

  private taskResults = [] as Array<{
    task: Task;
    status: TaskStatus;
    code: number;
  }>;

  constructor(
    private readonly command: string = parseCommand(),
    private readonly storeFile = storeFileFunction,
    private readonly now = () => new Date().toISOString()
  ) {}

  startTasks(tasks: Task[]): void {
    for (let t of tasks) {
      this.timings[t.id] = {
        start: this.now(),
        end: undefined,
      };
    }
  }

  endTasks(
    taskResults: Array<{ task: Task; status: TaskStatus; code: number }>
  ): void {
    for (let tr of taskResults) {
      if (tr.task.startTime) {
        this.timings[tr.task.id].start = new Date(
          tr.task.startTime
        ).toISOString();
      }
      if (tr.task.endTime) {
        this.timings[tr.task.id].end = new Date(tr.task.endTime).toISOString();
      } else {
        this.timings[tr.task.id].end = this.now();
      }
    }
    this.taskResults.push(...taskResults);
  }

  startCommand() {
    this.startTime = this.now();
  }

  endCommand(): any {
    try {
      const endTime = this.now();
      const runDetails = {
        run: {
          command: this.command,
          startTime: this.startTime,
          endTime: endTime,
          inner: false,
        },
        tasks: this.taskResults.map((tr) => {
          const cacheStatus =
            tr.status === 'remote-cache'
              ? 'remote-cache-hit'
              : tr.status === 'local-cache' ||
                tr.status === 'local-cache-kept-existing'
              ? 'local-cache-hit'
              : 'cache-miss';
          return {
            taskId: tr.task.id,
            target: tr.task.target.target,
            projectName: tr.task.target.project,
            hash: tr.task.hash,
            startTime: this.timings[tr.task.id].start,
            endTime: this.timings[tr.task.id].end,
            params: '',
            cacheStatus,
            status: tr.code,
          };
        }),
      };
      this.storeFile(runDetails);
    } catch (e) {
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.error(e);
      }
    }
  }
}

function parseCommand() {
  const cmdBase = parse(process.argv[1]).name;
  const args = `${process.argv.slice(2).join(' ')}`;
  return `${cmdBase} ${args}`;
}

function storeFileFunction(runDetails: any) {
  writeFileSync(
    join(cacheDir, 'run.json'),
    JSON.stringify(runDetails, null, 2)
  );
}
