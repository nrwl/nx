import { useRef, useState } from 'react';
import type { TaskPriority } from '../models';
import './TaskForm.css';

interface TaskFormProps
{
    onSubmit: (data: { title: string; description: string; priority: TaskPriority; tags: string[] }) => void;
}

export function TaskFormComponent({ onSubmit }: TaskFormProps)
{
    const titleInputRef = useRef<HTMLInputElement>(null);

    const [isExpanded, setIsExpanded] = useState(false);
    const [taskTitle, setTaskTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TaskPriority>('medium');
    const [tagsInput, setTagsInput] = useState('');

    const parsedTags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

    const resetForm = () =>
    {
        setTaskTitle('');
        setDescription('');
        setPriority('medium');
        setTagsInput('');
    };

    const toggleForm = () =>
    {
        setIsExpanded(!isExpanded);
        if (isExpanded)
        {
            resetForm();
        }
    };

    const focusTitleTemplateRef = (input: HTMLInputElement | null) =>
    {
        input?.focus();
    };

    const focusTitleUseRef = () =>
    {
        titleInputRef.current?.focus();
    };

    const handleSubmit = () =>
    {
        if (!taskTitle.trim()) return;

        onSubmit({
            title: taskTitle.trim(),
            description: description.trim(),
            priority,
            tags: parsedTags
        });

        resetForm();
        setIsExpanded(false);
    };

    const handleKeyUp = (e: React.KeyboardEvent) =>
    {
        if (e.key === 'Enter')
        {
            handleSubmit();
        }
    };

    return (
        <div className="form-wrapper">
            <button className="add-btn" onClick={toggleForm}>
                {isExpanded ? '✕ Cancel' : '+ New Task'}
            </button>

            {isExpanded && (
                <div className="form-panel">
                    <div className="form-group">
                        <label>Title *</label>
                        <input
                            ref={titleInputRef}
                            type="text"
                            placeholder="What needs to be done?"
                            value={taskTitle}
                            onChange={(e) => setTaskTitle(e.target.value)}
                            onKeyUp={handleKeyUp}
                        />
                    </div>

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            placeholder="Add more details..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        ></textarea>
                    </div>

                    <div className="form-group">
                        <label>Priority</label>
                        <div className="priority-selector">
                            <button
                                className={`priority-btn low ${priority === 'low' ? 'selected' : ''}`}
                                onClick={() => setPriority('low')}
                            >Low
                            </button>
                            <button
                                className={`priority-btn medium ${priority === 'medium' ? 'selected' : ''}`}
                                onClick={() => setPriority('medium')}
                            >Medium
                            </button>
                            <button
                                className={`priority-btn high ${priority === 'high' ? 'selected' : ''}`}
                                onClick={() => setPriority('high')}
                            >High
                            </button>
                            <button
                                className={`priority-btn urgent ${priority === 'urgent' ? 'selected' : ''}`}
                                onClick={() => setPriority('urgent')}
                            >Urgent
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Tags (comma-separated)</label>
                        <input
                            type="text"
                            placeholder="frontend, bug, feature..."
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                        />
                        {parsedTags.length > 0 && (
                            <div className="tag-preview">
                                {parsedTags.map((tag) => (
                                    <span key={tag} className="tag">{tag}</span>
                                ))}
                            </div>
                        )}
                    </div>

                    <button className="submit-btn" onClick={handleSubmit}>
                        Create Task
                    </button>
                    <button className="submit-btn" onClick={() => focusTitleTemplateRef(titleInputRef.current)}>
                        Focus Title (Callback Ref)
                    </button>
                    <button className="submit-btn" onClick={focusTitleUseRef}>
                        Focus Title (useRef)
                    </button>
                </div>
            )}
        </div>
    );
}
