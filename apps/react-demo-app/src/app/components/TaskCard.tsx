import { useEffect, useState } from 'react';
import type { Task, TaskPriority, TaskStatus } from '../models';
import './TaskCard.css';

interface TaskCardProps
{
    task: Task;
    isEditing: boolean;
    availableStatuses: TaskStatus[];
    onMove: (newStatus: TaskStatus) => void;
    onDelete: () => void;
    onEdit: () => void;
    onCancelEdit: () => void;
    onSave: (updates: Partial<Task>) => void;
}

export function TaskCardComponent({
                                      task,
                                      isEditing,
                                      availableStatuses,
                                      onMove,
                                      onDelete,
                                      onEdit,
                                      onCancelEdit,
                                      onSave
                                  }: TaskCardProps)
{
    const [isDragging, setIsDragging] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
    const [editAssignee, setEditAssignee] = useState('');
    const [editDueDate, setEditDueDate] = useState('');
    const [showMoveMenu, setShowMoveMenu] = useState(false);

    useEffect(() =>
    {
        if(isEditing && task)
        {
            setEditTitle(task.title);
            setEditDescription(task.description);
            setEditPriority(task.priority);
            setEditAssignee(task.assignee ?? '');
            setEditDueDate(task.dueDate ?? '');
        }
    }, [isEditing, task]);

    const priorityClass = task.priority;

    const today = new Date().toISOString()
        .split('T')[0];
    const isOverdue = task.dueDate && task.dueDate < today && task.status !== 'done';
    const isDueToday = task.dueDate === today;

    const formattedDueDate = task.dueDate
        ? new Date(task.dueDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})
        : '';

    const getStatusLabel = (status: TaskStatus): string =>
    {
        const labels: Record<TaskStatus, string> = {
            'todo': '📋 To Do',
            'in-progress': '🔄 In Progress',
            'done': '✅ Done'
        };
        return labels[status];
    };

    const handleDragStart = (e: React.DragEvent) =>
    {
        e.dataTransfer.setData('text/plain', String(task.id));
        setIsDragging(true);
    };

    const handleDragEnd = () =>
    {
        setIsDragging(false);
    };

    const handleSave = () =>
    {
        onSave({
            title: editTitle,
            description: editDescription,
            priority: editPriority,
            assignee: editAssignee || null,
            dueDate: editDueDate || null
        });
    };

    const capitalize = (str: string) => str.charAt(0)
        .toUpperCase() + str.slice(1)
        .toLowerCase();
    const truncate = (str: string, len: number) => str.length > len ? str.slice(0, len) + '...' : str;

    if(isEditing)
    {
        return (
            <div className={`task-card ${isDragging ? 'dragging' : ''}`}>
                <div className="card editing">
                    <div className="edit-form">
                        <input
                            type="text"
                            className="edit-title"
                            placeholder="Task title"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                        />

                        <textarea
                            className="edit-description"
                            placeholder="Description"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                        ></textarea>

                        <div className="edit-row">
                            <label>Priority:</label>
                            <div className="priority-buttons">
                                <button
                                    className={`p-btn low ${editPriority === 'low' ? 'active' : ''}`}
                                    onClick={() => setEditPriority('low')}
                                >Low
                                </button>
                                <button
                                    className={`p-btn medium ${editPriority === 'medium' ? 'active' : ''}`}
                                    onClick={() => setEditPriority('medium')}
                                >Med
                                </button>
                                <button
                                    className={`p-btn high ${editPriority === 'high' ? 'active' : ''}`}
                                    onClick={() => setEditPriority('high')}
                                >High
                                </button>
                                <button
                                    className={`p-btn urgent ${editPriority === 'urgent' ? 'active' : ''}`}
                                    onClick={() => setEditPriority('urgent')}
                                >Urgent
                                </button>
                            </div>
                        </div>

                        <div className="edit-row">
                            <label>Assignee:</label>
                            <input
                                type="text"
                                placeholder="Name"
                                value={editAssignee}
                                onChange={(e) => setEditAssignee(e.target.value)}
                            />
                        </div>

                        <div className="edit-row">
                            <label>Due Date:</label>
                            <input
                                type="date"
                                value={editDueDate}
                                onChange={(e) => setEditDueDate(e.target.value)}
                            />
                        </div>

                        <div className="edit-actions">
                            <button className="save-btn" onClick={handleSave}>💾 Save</button>
                            <button className="cancel-btn" onClick={onCancelEdit}>Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`task-card ${isDragging ? 'dragging' : ''}`}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className={`card ${isOverdue ? 'overdue' : ''}`}>
                <div className="card-header">
                    <span className={`priority-indicator ${priorityClass}`}></span>
                    <div className="card-actions">
                        <button className="action-btn" onClick={() => setShowMoveMenu(!showMoveMenu)} title="Move">↔️
                        </button>
                        <button className="action-btn" onClick={onEdit} title="Edit">✏️</button>
                        <button className="action-btn delete" onClick={onDelete} title="Delete">🗑️</button>
                    </div>
                </div>

                {showMoveMenu && (
                    <div className="move-menu">
                        {availableStatuses.map((status) => (
                            <button
                                key={status}
                                className="move-option"
                                onClick={() =>
                                {
                                    setShowMoveMenu(false);
                                    onMove(status);
                                }}
                            >
                                {getStatusLabel(status)}
                            </button>
                        ))}
                    </div>
                )}

                <h3 className="card-title">{task.title.toUpperCase()}</h3>

                {task.description && (
                    <p className="card-description">{truncate(task.description, 80)}</p>
                )}

                <div className="card-meta">
                    {task.tags.length > 0 && (
                        <div className="tags">
                            {task.tags.map((tag) => (
                                <span key={tag} className="tag">{capitalize(tag.toLowerCase())}</span>
                            ))}
                        </div>
                    )}

                    <div className="meta-row">
                        {task.assignee && (
                            <span className="assignee">👤 {task.assignee}</span>
                        )}

                        {task.dueDate && (
                            <span className={`due-date ${isOverdue ? 'overdue' : ''} ${isDueToday ? 'today' : ''}`}>
                                📅 {formattedDueDate}
                                {isOverdue && <span className="overdue-badge">Overdue!</span>}
                                {isDueToday && <span className="today-badge">Today</span>}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
