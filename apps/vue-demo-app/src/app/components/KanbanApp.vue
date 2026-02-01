<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { Column, Task, TaskPriority, TaskStats, TaskStatus } from '../models';
import KanbanColumnComponent from './KanbanColumn.vue';
import TaskFormComponent from './TaskForm.vue';
import TaskStatsComponent from './TaskStats.vue';

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
  { id: 'todo', title: 'To Do', color: '#e74c3c' },
  { id: 'in-progress', title: 'In Progress', color: '#f39c12' },
  { id: 'done', title: 'Done', color: '#27ae60' }
];

const currentTime = ref(new Date().toLocaleTimeString());
const tasks = ref<Task[]>(initialTasks);
const searchQuery = ref('');
const filterPriority = ref<TaskPriority | 'all'>('all');
const filterAssignee = ref('all');
const showStats = ref(true);
const editingTaskId = ref<number | null>(null);
const nextId = ref(9);

let intervalId: ReturnType<typeof setInterval> | null = null;

onMounted(() =>
{
  intervalId = setInterval(() =>
  {
    currentTime.value = new Date().toLocaleTimeString();
  }, 1000);
});

onUnmounted(() =>
{
  if (intervalId !== null)
  {
    clearInterval(intervalId);
  }
});

const filteredTasks = computed(() =>
{
  return tasks.value.filter(task =>
  {
    const matchesSearch = !searchQuery.value ||
        task.title.toLowerCase()
            .includes(searchQuery.value.toLowerCase()) ||
        task.description.toLowerCase()
            .includes(searchQuery.value.toLowerCase()) ||
        task.tags.some(tag => tag.toLowerCase()
            .includes(searchQuery.value.toLowerCase()));

    const matchesPriority = filterPriority.value === 'all' || task.priority === filterPriority.value;
    const matchesAssignee = filterAssignee.value === 'all' || task.assignee === filterAssignee.value;

    return matchesSearch && matchesPriority && matchesAssignee;
  });
});

const stats = computed((): TaskStats =>
{
  const today = new Date().toISOString()
      .split('T')[0];
  return {
    total: tasks.value.length,
    byStatus: {
      'todo': tasks.value.filter(t => t.status === 'todo').length,
      'in-progress': tasks.value.filter(t => t.status === 'in-progress').length,
      'done': tasks.value.filter(t => t.status === 'done').length
    },
    byPriority: {
      'low': tasks.value.filter(t => t.priority === 'low').length,
      'medium': tasks.value.filter(t => t.priority === 'medium').length,
      'high': tasks.value.filter(t => t.priority === 'high').length,
      'urgent': tasks.value.filter(t => t.priority === 'urgent').length
    },
    overdue: tasks.value.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length,
    dueToday: tasks.value.filter(t => t.dueDate === today).length
  };
});

const assignees = computed(() =>
{
  const names = new Set(tasks.value.map(t => t.assignee)
      .filter((a): a is string => a !== null));
  return ['all', ...names];
});

const priorities: (TaskPriority | 'all')[] = ['all', 'low', 'medium', 'high', 'urgent'];

const getTasksForColumn = (status: TaskStatus): Task[] =>
{
  return filteredTasks.value.filter(t => t.status === status);
};

const addTask = (data: { title: string; description: string; priority: TaskPriority; tags: string[] }) =>
{
  const newTask: Task = {
    id: nextId.value,
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
  tasks.value = [...tasks.value, newTask];
  nextId.value++;
};

const moveTask = (taskId: number, newStatus: TaskStatus) =>
{
  tasks.value = tasks.value.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
};

const updateTask = (taskId: number, updates: Partial<Task>) =>
{
  tasks.value = tasks.value.map(t => t.id === taskId ? { ...t, ...updates } : t);
  editingTaskId.value = null;
};

const deleteTask = (taskId: number) =>
{
  tasks.value = tasks.value.filter(t => t.id !== taskId);
};

const startEditing = (taskId: number) =>
{
  editingTaskId.value = taskId;
};

const cancelEditing = () =>
{
  editingTaskId.value = null;
};

const toggleStats = () =>
{
  showStats.value = !showStats.value;
};

const setSearch = (query: string) =>
{
  searchQuery.value = query;
};

const setFilterPriority = (priority: TaskPriority | 'all') =>
{
  filterPriority.value = priority;
};

const setFilterAssignee = (assignee: string) =>
{
  filterAssignee.value = assignee;
};
</script>

<template>
  <div class="kanban-app-container">
    <div class="kanban-app">
      <header class="app-header">
        <div class="header-left">
          <h1>🗂️ Kanban Board</h1>
          <span class="task-count">{{ stats.total }} tasks</span>
          <span class="current-time">🕐 {{ currentTime }}</span>
        </div>
        <div class="header-actions">
          <button
            class="stats-toggle"
            @click="toggleStats"
          >
            <template v-if="showStats">
              📊 Hide Stats
            </template>
            <template v-else>
              📊 Show Stats
            </template>
          </button>
        </div>
      </header>

      <TaskStatsComponent
        v-if="showStats"
        :stats="stats"
      />

      <div class="toolbar">
        <div class="search-box">
          <input
            type="text"
            placeholder="🔍 Search tasks, tags..."
            :value="searchQuery"
            @input="setSearch(($event.target as HTMLInputElement).value)"
          >
        </div>

        <div class="filters">
          <label>
            Priority:
            <select
              :value="filterPriority"
              @change="setFilterPriority(($event.target as HTMLSelectElement).value as TaskPriority | 'all')"
            >
              <option
                v-for="p in priorities"
                :key="p"
                :value="p"
              >{{ p }}
              </option>
            </select>
          </label>

          <label>
            Assignee:
            <select
              :value="filterAssignee"
              @change="setFilterAssignee(($event.target as HTMLSelectElement).value)"
            >
              <option
                v-for="a in assignees"
                :key="a"
                :value="a"
              >{{ a }}
              </option>
            </select>
          </label>
        </div>
      </div>

      <TaskFormComponent @submit="addTask" />

      <div class="board">
        <KanbanColumnComponent
          v-for="column in columns"
          :key="column.id"
          :column="column"
          :tasks="getTasksForColumn(column.id)"
          :editing-task-id="editingTaskId"
          @move-task="moveTask"
          @delete-task="deleteTask"
          @start-edit="startEditing"
          @cancel-edit="cancelEditing"
          @save-edit="updateTask"
        />
      </div>

      <div
        v-if="filteredTasks.length === 0"
        class="empty-state"
      >
        <p>No tasks match your filters.</p>
        <button @click="setSearch('')">
          Clear search
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kanban-app-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  min-height: 100vh;
  padding: 20px;
  box-sizing: border-box;
}

.kanban-app {
  max-width: 1400px;
  margin: 0 auto;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-header h1 {
  margin: 0;
  color: #fff;
  font-size: 1.8rem;
  font-weight: 600;
}

.task-count {
  background: rgba(255, 255, 255, 0.1);
  color: #a0aec0;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
}

.current-time {
  background: rgba(102, 126, 234, 0.2);
  color: #a0aec0;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.stats-toggle {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.95rem;
}

.stats-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
}

.toolbar {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 250px;
}

.search-box input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 1rem;
  box-sizing: border-box;
}

.search-box input::placeholder {
  color: #718096;
}

.search-box input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.filters {
  display: flex;
  gap: 16px;
  align-items: center;
}

.filters label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #a0aec0;
  font-size: 0.9rem;
}

.filters select {
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 0.9rem;
  cursor: pointer;
}

.filters select:focus {
  outline: none;
  border-color: #667eea;
}

.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 20px;
}

@media (max-width: 1024px) {
  .board {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 700px) {
  .board {
    grid-template-columns: 1fr;
  }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-top: 20px;
}

.empty-state p {
  color: #a0aec0;
  font-size: 1.1rem;
  margin: 0 0 20px 0;
}

.empty-state button {
  background: #667eea;
  border: none;
  color: #fff;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.empty-state button:hover {
  background: #5a67d8;
}
</style>
