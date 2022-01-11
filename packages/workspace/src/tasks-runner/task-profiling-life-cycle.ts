import { LifeCycle, TaskMetadata } from './life-cycle';
import { Task, writeJsonFile } from '@nrwl/devkit';
import { TaskStatus } from './tasks-runner';

import { performance } from 'perf_hooks';
import { join } from 'path';

export class TaskProfilingLifeCycle implements LifeCycle {
  private timings: {
    [target: string]: {
      perfStart: number;
      perfEnd?: number;
    };
  } = {};
  private profile = [];
  private readonly profileFile: string;
  private registeredGroups = new Set();

  constructor(_profileFile: string) {
    this.profileFile = join(process.cwd(), _profileFile);
  }

  startTasks(tasks: Task[], { groupId }: TaskMetadata): void {
    if (this.profileFile && !this.registeredGroups.has(groupId)) {
      this.registerGroup(groupId);
    }
    for (let t of tasks) {
      this.timings[`${t.target.project}:${t.target.target}`] = {
        perfStart: performance.now(),
      };
    }
  }

  endTasks(
    taskResults: Array<{ task: Task; status: TaskStatus; code: number }>,
    metadata: TaskMetadata
  ): void {
    for (let tr of taskResults) {
      this.timings[
        `${tr.task.target.project}:${tr.task.target.target}`
      ].perfEnd = performance.now();
    }
    this.recordTaskCompletions(taskResults, metadata);
  }

  endCommand(): void {
    writeJsonFile(this.profileFile, this.profile);
    console.log(`Performance Profile: ${this.profileFile}`);
  }

  private recordTaskCompletions(
    tasks: Array<{ task: Task; status: TaskStatus }>,
    { groupId }: TaskMetadata
  ) {
    for (const { task, status } of tasks) {
      const { perfStart, perfEnd } =
        this.timings[`${task.target.project}:${task.target.target}`];
      this.profile.push({
        name: task.id,
        cat: Object.values(task.target).join(','),
        ph: 'X',
        ts: perfStart * 1000,
        dur: (perfEnd - perfStart) * 1000,
        pid: process.pid,
        tid: groupId,
        args: {
          target: task.target,
          status,
        },
      });
    }
  }

  private registerGroup(groupId: number) {
    this.profile.push({
      name: 'thread_name',
      ph: 'M',
      pid: process.pid,
      tid: groupId,
      ts: 0,
      args: {
        name: 'Group #' + (groupId + 1),
      },
    });
    this.registeredGroups.add(groupId);
  }
}
