import type { TaskStats } from '../models';
import './TaskStats.css';

interface TaskStatsProps
{
    stats: TaskStats;
}

export function TaskStatsComponent({ stats }: TaskStatsProps)
{
    const completionPercent = stats.total === 0 ? 0 : Math.round((stats.byStatus.done / stats.total) * 100);
    const urgentAndHighCount = stats.byPriority.urgent + stats.byPriority.high;

    return (
        <div className="stats-panel">
            <div className="stat-card completion">
                <div className="stat-icon">✅</div>
                <div className="stat-content">
                    <span className="stat-value">{completionPercent}%</span>
                    <span className="stat-label">Completed</span>
                </div>
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${completionPercent}%` }}></div>
                </div>
            </div>

            <div className="stat-card status">
                <div className="stat-icon">📋</div>
                <div className="stat-content">
                    <div className="stat-row">
                        <span className="dot todo"></span>
                        <span>To Do: {stats.byStatus['todo']}</span>
                    </div>
                    <div className="stat-row">
                        <span className="dot in-progress"></span>
                        <span>In Progress: {stats.byStatus['in-progress']}</span>
                    </div>
                    <div className="stat-row">
                        <span className="dot done"></span>
                        <span>Done: {stats.byStatus['done']}</span>
                    </div>
                </div>
            </div>

            <div className="stat-card priority">
                <div className="stat-icon">🎯</div>
                <div className="stat-content">
                    <span className="stat-value">{urgentAndHighCount}</span>
                    <span className="stat-label">High Priority</span>
                </div>
            </div>

            <div className="stat-card alerts">
                <div className="stat-icon">⚠️</div>
                <div className="stat-content">
                    {stats.overdue > 0 && (
                        <div className="alert-item overdue">
                            <span className="alert-count">{stats.overdue}</span>
                            <span>Overdue</span>
                        </div>
                    )}
                    {stats.dueToday > 0 && (
                        <div className="alert-item due-today">
                            <span className="alert-count">{stats.dueToday}</span>
                            <span>Due Today</span>
                        </div>
                    )}
                    {stats.overdue === 0 && stats.dueToday === 0 && (
                        <span className="all-clear">All clear! 🎉</span>
                    )}
                </div>
            </div>
        </div>
    );
}
