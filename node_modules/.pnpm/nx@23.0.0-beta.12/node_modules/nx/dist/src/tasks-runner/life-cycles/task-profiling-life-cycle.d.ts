import { LifeCycle, TaskMetadata, TaskResult } from '../life-cycle';
import { Task } from '../../config/task-graph';
export declare class TaskProfilingLifeCycle implements LifeCycle {
    private timings;
    private profile;
    private readonly profileFile;
    private registeredGroups;
    constructor(_profileFile: string);
    startTasks(tasks: Task[], { groupId }: TaskMetadata): void;
    endTasks(taskResults: TaskResult[], metadata: TaskMetadata): void;
    endCommand(): void;
    private recordTaskCompletions;
    private registerGroup;
}
