import type { LifeCycle, TaskResult, TaskMetadata } from '../life-cycle';
export declare class TaskTelemetryLifeCycle implements LifeCycle {
    private taskCount;
    private cachedTaskCount;
    private projects;
    startCommand(): void;
    endTasks(taskResults: TaskResult[], metadata: TaskMetadata): void;
    endCommand(): void;
}
