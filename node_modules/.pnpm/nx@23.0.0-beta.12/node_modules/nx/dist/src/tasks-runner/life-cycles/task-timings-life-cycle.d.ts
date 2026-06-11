import { Task } from '../../config/task-graph';
import { LifeCycle, TaskResult } from '../life-cycle';
export declare class TaskTimingsLifeCycle implements LifeCycle {
    private timings;
    startTasks(tasks: Task[]): void;
    endTasks(taskResults: TaskResult[]): void;
    endCommand(): void;
}
