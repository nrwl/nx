export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task
{
    id: number;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    tags: string[];
    dueDate: string | null;
    createdAt: string;
    assignee: string | null;
}

export interface Column
{
    id: TaskStatus;
    title: string;
    color: string;
}

export interface TaskStats
{
    total: number;
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<TaskPriority, number>;
    overdue: number;
    dueToday: number;
}
