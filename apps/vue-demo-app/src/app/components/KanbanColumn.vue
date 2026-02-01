<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Column, Task, TaskStatus } from '../models';
import TaskCard from './TaskCard.vue';

const props = defineProps<{
  column: Column;
  tasks: Task[];
  editingTaskId: number | null;
}>();

const emit = defineEmits<{
  moveTask: [taskId: number, newStatus: TaskStatus];
  deleteTask: [taskId: number];
  startEdit: [taskId: number];
  cancelEdit: [];
  saveEdit: [taskId: number, updates: Partial<Task>];
}>();

const isDragOver = ref(false);

const availableStatuses = computed((): TaskStatus[] =>
{
  return (['todo', 'in-progress', 'done'] as TaskStatus[]).filter(s => s !== props.column.id);
});

const handleDragOver = (e: DragEvent) =>
{
  e.preventDefault();
  isDragOver.value = true;
};

const handleDragLeave = () =>
{
  isDragOver.value = false;
};

const handleDrop = (e: DragEvent) =>
{
  e.preventDefault();
  isDragOver.value = false;
  const taskId = e.dataTransfer?.getData('text/plain');
  if (taskId)
  {
    emit('moveTask', Number(taskId), props.column.id);
  }
};
</script>

<template>
  <div
    class="kanban-column"
    :class="{ 'drag-over': isDragOver }"
    :data-column-id="column.id"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div class="column">
      <div
        class="column-header"
        :style="{ borderColor: column.color }"
      >
        <h2>{{ column.title }}</h2>
        <span class="count">{{ tasks.length }}</span>
      </div>

      <div class="task-list">
        <TaskCard
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          :is-editing="editingTaskId === task.id"
          :available-statuses="availableStatuses"
          @move="emit('moveTask', task.id, $event)"
          @delete="emit('deleteTask', task.id)"
          @edit="emit('startEdit', task.id)"
          @cancel-edit="emit('cancelEdit')"
          @save="emit('saveEdit', task.id, $event)"
        />

        <div
          v-if="tasks.length === 0"
          class="empty-column"
        >
          <span>No tasks</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kanban-column {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.kanban-column.drag-over {
  transform: scale(1.02);
  box-shadow: 0 0 20px rgba(99, 179, 237, 0.4);
}

.kanban-column.drag-over .column {
  border-color: rgba(99, 179, 237, 0.6);
  background: rgba(99, 179, 237, 0.1);
}

.column {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  min-height: 400px;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 3px solid;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px 12px 0 0;
}

.column-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
}

.count {
  background: rgba(255, 255, 255, 0.1);
  color: #a0aec0;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.task-list {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.empty-column {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #4a5568;
  font-style: italic;
  padding: 40px;
}
</style>
