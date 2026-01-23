import { useEffect, useMemo, useState } from 'react';
import type { Column, Task, TaskPriority, TaskStats, TaskStatus } from '../models';
import { KanbanColumnComponent } from './KanbanColumn';
import { TaskFormComponent } from './TaskForm';
import { TaskStatsComponent } from './TaskStats';
import './KanbanApp.css';

const initialTasks: Task[] = [
    {
        id: 1,
        title: 'Design system architecture',
        description: 'Create high-level design docs',
        status: 'done',
        priority: 'high',
        tags: ['architecture', 'docs'],
        dueDate: '2026-01-20',
        createdAt: '2026-01-15',
        assignee: 'Alice'
    }, {
        id: 2,
        title: 'Implement auth module',
        description: 'JWT-based authentication with refresh tokens',
        status: 'in-progress',
        priority: 'urgent',
        tags: ['backend', 'security'],
        dueDate: '2026-01-25',
        createdAt: '2026-01-16',
        assignee: 'Bob'
    }, {
        id: 3,
        title: 'Setup CI/CD pipeline',
        description: 'GitHub Actions with Docker',
        status: 'in-progress',
        priority: 'high',
        tags: ['devops'],
        dueDate: '2026-01-23',
        createdAt: '2026-01-17',
        assignee: 'Charlie'
    }, {
        id: 4,
        title: 'Write API documentation',
        description: 'OpenAPI spec for all endpoints',
        status: 'todo',
        priority: 'medium',
        tags: ['docs', 'api'],
        dueDate: '2026-01-28',
        createdAt: '2026-01-18',
        assignee: null
    }, {
        id: 5,
        title: 'Database optimization',
        description: 'Add indexes, query optimization',
        status: 'todo',
        priority: 'low',
        tags: ['backend', 'performance'],
        dueDate: null,
        createdAt: '2026-01-19',
        assignee: 'Alice'
    }, {
        id: 6,
        title: 'Unit tests for core',
        description: 'Achieve 80% coverage',
        status: 'todo',
        priority: 'high',
        tags: ['testing'],
        dueDate: '2026-01-22',
        createdAt: '2026-01-20',
        assignee: 'Bob'
    }, {
        id: 7,
        title: 'Fix login bug',
        description: 'Session not persisting after refresh',
        status: 'in-progress',
        priority: 'urgent',
        tags: ['bug', 'frontend'],
        dueDate: '2026-01-21',
        createdAt: '2026-01-21',
        assignee: 'Diana'
    }, {
        id: 8,
        title: 'Mobile responsive design',
        description: 'Ensure all views work on mobile',
        status: 'todo',
        priority: 'medium',
        tags: ['frontend', 'design'],
        dueDate: '2026-01-30',
        createdAt: '2026-01-21',
        assignee: null
    }
];

const columns: Column[] = [
    {id: 'todo', title: 'To Do', color: '#e74c3c'},
    {id: 'in-progress', title: 'In Progress', color: '#f39c12'},
    {id: 'done', title: 'Done', color: '#27ae60'}
];

export function KanbanAppComponent()
{
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
    const [tasks, setTasks] = useState<Task[]>(initialTasks);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
    const [filterAssignee, setFilterAssignee] = useState('all');
    const [showStats, setShowStats] = useState(true);
    const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
    const [nextId, setNextId] = useState(9);

    useEffect(() =>
    {
        const intervalId = setInterval(() =>
        {
            setCurrentTime(new Date().toLocaleTimeString());
        }, 1000);
        return () => clearInterval(intervalId);
    }, []);

    const filteredTasks = useMemo(() =>
    {
        return tasks.filter(task =>
        {
            const matchesSearch = !searchQuery ||
                task.title.toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                task.description.toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                task.tags.some(tag => tag.toLowerCase()
                    .includes(searchQuery.toLowerCase()));

            const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
            const matchesAssignee = filterAssignee === 'all' || task.assignee === filterAssignee;

            return matchesSearch && matchesPriority && matchesAssignee;
        });
    }, [tasks, searchQuery, filterPriority, filterAssignee]);

    const stats: TaskStats = useMemo(() =>
    {
        const today = new Date().toISOString()
            .split('T')[0];
        return {
            total: tasks.length,
            byStatus: {
                'todo': tasks.filter(t => t.status === 'todo').length,
                'in-progress': tasks.filter(t => t.status === 'in-progress').length,
                'done': tasks.filter(t => t.status === 'done').length
            },
            byPriority: {
                'low': tasks.filter(t => t.priority === 'low').length,
                'medium': tasks.filter(t => t.priority === 'medium').length,
                'high': tasks.filter(t => t.priority === 'high').length,
                'urgent': tasks.filter(t => t.priority === 'urgent').length
            },
            overdue: tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length,
            dueToday: tasks.filter(t => t.dueDate === today).length
        };
    }, [tasks]);

    const assignees = useMemo(() =>
    {
        const names = new Set(tasks.map(t => t.assignee)
            .filter((a): a is string => a !== null));
        return ['all', ...names];
    }, [tasks]);

    const priorities: (TaskPriority | 'all')[] = ['all', 'low', 'medium', 'high', 'urgent'];

    const getTasksForColumn = (status: TaskStatus): Task[] =>
    {
        return filteredTasks.filter(t => t.status === status);
    };

    const addTask = (data: { title: string; description: string; priority: TaskPriority; tags: string[] }) =>
    {
        const newTask: Task = {
            id: nextId,
            title: data.title,
            description: data.description,
            status: 'todo',
            priority: data.priority,
            tags: data.tags,
            dueDate: null,
            createdAt: new Date().toISOString()
                .split('T')[0],
            assignee: null
        };
        setTasks([...tasks, newTask]);
        setNextId(nextId + 1);
    };

    const moveTask = (taskId: number, newStatus: TaskStatus) =>
    {
        setTasks(tasks.map(t => t.id === taskId ? {...t, status: newStatus} : t));
    };

    const updateTask = (taskId: number, updates: Partial<Task>) =>
    {
        setTasks(tasks.map(t => t.id === taskId ? {...t, ...updates} : t));
        setEditingTaskId(null);
    };

    const deleteTask = (taskId: number) =>
    {
        setTasks(tasks.filter(t => t.id !== taskId));
    };

    return (
        <div className="kanban-app-container">
            <div className="kanban-app">
                <header className="app-header">
                    <div className="header-left">
                        <h1>🗂️ Kanban Board</h1>
                        <span className="task-count">{stats.total} tasks</span>
                        <span className="current-time">🕐 {currentTime}</span>
                    </div>
                    <div className="header-actions">
                        <button className="stats-toggle" onClick={() => setShowStats(!showStats)}>
                            {showStats ? '📊 Hide Stats' : '📊 Show Stats'}
                        </button>
                    </div>
                </header>

                {showStats && <TaskStatsComponent stats={stats}/>}

                <div className="toolbar">
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="🔍 Search tasks, tags..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="filters">
                        <label>
                            Priority:
                            <select
                                value={filterPriority}
                                onChange={(e) => setFilterPriority(e.target.value as TaskPriority | 'all')}
                            >
                                {priorities.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Assignee:
                            <select
                                value={filterAssignee}
                                onChange={(e) => setFilterAssignee(e.target.value)}
                            >
                                {assignees.map(a => (
                                    <option key={a} value={a}>{a}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>

                <TaskFormComponent onSubmit={addTask}/>

                <div className="board">
                    {columns.map(column => (
                        <KanbanColumnComponent
                            key={column.id}
                            column={column}
                            tasks={getTasksForColumn(column.id)}
                            editingTaskId={editingTaskId}
                            onMoveTask={moveTask}
                            onDeleteTask={deleteTask}
                            onStartEdit={setEditingTaskId}
                            onCancelEdit={() => setEditingTaskId(null)}
                            onSaveEdit={updateTask}
                        />
                    ))}
                </div>

                {filteredTasks.length === 0 && (
                    <div className="empty-state">
                        <p>No tasks match your filters.</p>
                        <button onClick={() => setSearchQuery('')}>Clear search</button>
                    </div>
                )}
            </div>
        </div>
    );
}
