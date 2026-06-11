import type { LifeCycle } from '../life-cycle';
import { Task } from '../../config/task-graph';
/**
 * The following function is responsible for creating a life cycle with dynamic
 * outputs, meaning previous outputs can be rewritten or modified as new outputs
 * are added. It is therefore intended for use on a user's local machines.
 *
 * In CI environments the static equivalent of this life cycle should be used.
 *
 * NOTE: output.dim() should be preferred over output.colors.gray() because it
 * is much more consistently readable across different terminal color themes.
 */
export declare function createRunOneDynamicOutputRenderer({ initiatingProject, tasks, args, overrides, }: {
    initiatingProject: string;
    tasks: Task[];
    args: {
        configuration?: string;
        parallel?: number;
    };
    overrides: Record<string, unknown>;
}): Promise<{
    lifeCycle: LifeCycle;
    renderIsDone: Promise<void>;
}>;
