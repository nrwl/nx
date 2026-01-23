import { useState } from 'react';
import type { Column, Task, TaskStatus } from '../models';
import { TaskCardComponent } from './TaskCard';
import './KanbanColumn.css';

interface KanbanColumnProps
{
    column: Column;
    tasks: Task[];
    editingTaskId: number | null;
    onMoveTask: (taskId: number, newStatus: TaskStatus) => void;
    onDeleteTask: (taskId: number) => void;
    onStartEdit: (taskId: number) => void;
    onCancelEdit: () => void;
    onSaveEdit: (taskId: number, updates: Partial<Task>) => void;
}

export function KanbanColumnComponent({
                                          column,
                                          tasks,
                                          editingTaskId,
                                          onMoveTask,
                                          onDeleteTask,
                                          onStartEdit,
                                          onCancelEdit,
                                          onSaveEdit
                                      }: KanbanColumnProps)
{
    const [isDragOver, setIsDragOver] = useState(false);

    const availableStatuses: TaskStatus[] = (['todo', 'in-progress', 'done'] as TaskStatus[])
        .filter(s => s !== column.id);

    const handleDragOver = (e: React.DragEvent) =>
    {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () =>
    {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) =>
    {
        e.preventDefault();
        setIsDragOver(false);
        const taskId = e.dataTransfer.getData('text/plain');
        if(taskId)
        {
            onMoveTask(Number(taskId), column.id);
        }
    };

    return (
        <div
            className={`kanban-column ${isDragOver ? 'drag-over' : ''}`}
            data-column-id={column.id}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="column">
                <div className="column-header" style={{borderColor: column.color}}>
                    <h2>{column.title}</h2>
                    <span className="count">{tasks.length}</span>
                </div>

                <div className="task-list">
                    {tasks.map((task) => (
                        <TaskCardComponent
                            key={task.id}
                            task={task}
                            isEditing={editingTaskId === task.id}
                            availableStatuses={availableStatuses}
                            onMove={(newStatus) => onMoveTask(task.id, newStatus)}
                            onDelete={() => onDeleteTask(task.id)}
                            onEdit={() => onStartEdit(task.id)}
                            onCancelEdit={onCancelEdit}
                            onSave={(updates) => onSaveEdit(task.id, updates)}
                        />
                    ))}

                    {tasks.length === 0 && (
                        <div className="empty-column">
                            <span>No tasks</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
