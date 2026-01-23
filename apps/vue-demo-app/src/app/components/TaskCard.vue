<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Task, TaskPriority, TaskStatus } from '../models';

const props = defineProps<{
  task: Task;
  isEditing: boolean;
  availableStatuses: TaskStatus[];
}>();

const emit = defineEmits<{
  move: [newStatus: TaskStatus];
  delete: [];
  edit: [];
  cancelEdit: [];
  save: [updates: Partial<Task>];
}>();

const isDragging = ref(false);
const editTitle = ref('');
const editDescription = ref('');
const editPriority = ref<TaskPriority>('medium');
const editAssignee = ref('');
const editDueDate = ref('');
const showMoveMenu = ref(false);

watch(() => [props.isEditing, props.task], () =>
{
  if(props.isEditing && props.task)
  {
    editTitle.value = props.task.title;
    editDescription.value = props.task.description;
    editPriority.value = props.task.priority;
    editAssignee.value = props.task.assignee ?? '';
    editDueDate.value = props.task.dueDate ?? '';
  }
}, {immediate: true});

const priorityClass = computed(() => props.task.priority);

const today = computed(() => new Date().toISOString()
    .split('T')[0]);

const isOverdue = computed(() =>
{
  return props.task.dueDate && props.task.dueDate < today.value && props.task.status !== 'done';
});

const isDueToday = computed(() => props.task.dueDate === today.value);

const formattedDueDate = computed(() =>
{
  if(!props.task.dueDate) return '';
  const date = new Date(props.task.dueDate);
  return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
});

const getStatusLabel = (status: TaskStatus): string =>
{
  const labels: Record<TaskStatus, string> = {
    'todo': '📋 To Do',
    'in-progress': '🔄 In Progress',
    'done': '✅ Done'
  };
  return labels[status];
};

const handleDragStart = (e: DragEvent) =>
{
  e.dataTransfer?.setData('text/plain', String(props.task.id));
  isDragging.value = true;
};

const handleDragEnd = () =>
{
  isDragging.value = false;
};

const handleSave = () =>
{
  emit('save', {
    title: editTitle.value,
    description: editDescription.value,
    priority: editPriority.value,
    assignee: editAssignee.value || null,
    dueDate: editDueDate.value || null
  });
};

const capitalize = (str: string) => str.charAt(0)
    .toUpperCase() + str.slice(1)
    .toLowerCase();
const truncate = (str: string, len: number) => str.length > len ? str.slice(0, len) + '...' : str;

const setEditPriority = (p: TaskPriority) =>
{
  editPriority.value = p;
};

const onMove = (status: TaskStatus) =>
{
  showMoveMenu.value = false;
  emit('move', status);
};
</script>

<template>
  <div
    class="task-card"
    :class="{ dragging: isDragging }"
    :draggable="!isEditing"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
  >
    <template v-if="isEditing">
      <div class="card editing">
        <div class="edit-form">
          <input
            v-model="editTitle"
            type="text"
            class="edit-title"
            placeholder="Task title"
          >

          <textarea
            v-model="editDescription"
            class="edit-description"
            placeholder="Description"
          />

          <div class="edit-row">
            <label>Priority:</label>
            <div class="priority-buttons">
              <button
                class="p-btn low"
                :class="{ active: editPriority === 'low' }"
                @click="setEditPriority('low')"
              >
                Low
              </button>
              <button
                class="p-btn medium"
                :class="{ active: editPriority === 'medium' }"
                @click="setEditPriority('medium')"
              >
                Med
              </button>
              <button
                class="p-btn high"
                :class="{ active: editPriority === 'high' }"
                @click="setEditPriority('high')"
              >
                High
              </button>
              <button
                class="p-btn urgent"
                :class="{ active: editPriority === 'urgent' }"
                @click="setEditPriority('urgent')"
              >
                Urgent
              </button>
            </div>
          </div>

          <div class="edit-row">
            <label>Assignee:</label>
            <input
              v-model="editAssignee"
              type="text"
              placeholder="Name"
            >
          </div>

          <div class="edit-row">
            <label>Due Date:</label>
            <input
              v-model="editDueDate"
              type="date"
            >
          </div>

          <div class="edit-actions">
            <button
              class="save-btn"
              @click="handleSave"
            >
              💾 Save
            </button>
            <button
              class="cancel-btn"
              @click="emit('cancelEdit')"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div
        class="card"
        :class="{ overdue: isOverdue }"
      >
        <div class="card-header">
          <span
            class="priority-indicator"
            :class="priorityClass"
          />
          <div class="card-actions">
            <button
              class="action-btn"
              title="Move"
              @click="showMoveMenu = !showMoveMenu"
            >
              ↔️
            </button>
            <button
              class="action-btn"
              title="Edit"
              @click="emit('edit')"
            >
              ✏️
            </button>
            <button
              class="action-btn delete"
              title="Delete"
              @click="emit('delete')"
            >
              🗑️
            </button>
          </div>
        </div>

        <div
          v-if="showMoveMenu"
          class="move-menu"
        >
          <button
            v-for="status in availableStatuses"
            :key="status"
            class="move-option"
            @click="onMove(status)"
          >
            {{ getStatusLabel(status) }}
          </button>
        </div>

        <h3 class="card-title">
          {{ task.title.toUpperCase() }}
        </h3>

        <p
          v-if="task.description"
          class="card-description"
        >
          {{ truncate(task.description, 80) }}
        </p>

        <div class="card-meta">
          <div
            v-if="task.tags.length > 0"
            class="tags"
          >
            <span
              v-for="tag in task.tags"
              :key="tag"
              class="tag"
            >{{ capitalize(tag.toLowerCase()) }}</span>
          </div>

          <div class="meta-row">
            <span
              v-if="task.assignee"
              class="assignee"
            >👤 {{ task.assignee }}</span>

            <span
              v-if="task.dueDate"
              class="due-date"
              :class="{ overdue: isOverdue, today: isDueToday }"
            >
              📅 {{ formattedDueDate }}
              <span
                v-if="isOverdue"
                class="overdue-badge"
              >Overdue!</span>
              <span
                v-if="isDueToday"
                class="today-badge"
              >Today</span>
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.task-card {
  cursor: grab;
}

.task-card.dragging {
  opacity: 0.5;
  cursor: grabbing;
}

.task-card.dragging .card {
  transform: rotate(2deg);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
}

.card {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.card.overdue {
  border-color: rgba(231, 76, 60, 0.5);
  background: rgba(231, 76, 60, 0.08);
}

.card.editing {
  background: rgba(255, 255, 255, 0.08);
  border-color: #667eea;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.priority-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.priority-indicator.low {
  background: #718096;
}

.priority-indicator.medium {
  background: #48bb78;
}

.priority-indicator.high {
  background: #f39c12;
}

.priority-indicator.urgent {
  background: #e74c3c;
  box-shadow: 0 0 8px rgba(231, 76, 60, 0.6);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.card-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.card:hover .card-actions {
  opacity: 1;
}

.action-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: background 0.2s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.action-btn.delete:hover {
  background: rgba(231, 76, 60, 0.3);
}

.move-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

.move-option {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #e2e8f0;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.move-option:hover {
  background: rgba(255, 255, 255, 0.2);
}

.card-title {
  margin: 0 0 8px 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
  line-height: 1.3;
}

.card-description {
  margin: 0 0 12px 0;
  font-size: 0.85rem;
  color: #a0aec0;
  line-height: 1.4;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  background: rgba(102, 126, 234, 0.2);
  color: #a5b4fc;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.7rem;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.assignee {
  font-size: 0.8rem;
  color: #a0aec0;
}

.due-date {
  font-size: 0.8rem;
  color: #a0aec0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.due-date.overdue {
  color: #e74c3c;
}

.due-date.today {
  color: #f39c12;
}

.overdue-badge,
.today-badge {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 8px;
  font-weight: 600;
}

.overdue-badge {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
}

.today-badge {
  background: rgba(243, 156, 18, 0.2);
  color: #f39c12;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.edit-title {
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
}

.edit-description {
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 0.85rem;
  min-height: 60px;
  resize: vertical;
  font-family: inherit;
}

.edit-title:focus,
.edit-description:focus {
  outline: none;
  border-color: #667eea;
}

.edit-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.edit-row label {
  color: #a0aec0;
  font-size: 0.8rem;
  min-width: 70px;
}

.edit-row input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 0.85rem;
}

.edit-row input:focus {
  outline: none;
  border-color: #667eea;
}

.priority-buttons {
  display: flex;
  gap: 4px;
}

.p-btn {
  padding: 4px 10px;
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  color: #a0aec0;
  transition: all 0.2s;
}

.p-btn.low {
  border-color: #718096;
}

.p-btn.low.active {
  background: #718096;
  color: #fff;
}

.p-btn.medium {
  border-color: #48bb78;
}

.p-btn.medium.active {
  background: #48bb78;
  color: #fff;
}

.p-btn.high {
  border-color: #f39c12;
}

.p-btn.high.active {
  background: #f39c12;
  color: #fff;
}

.p-btn.urgent {
  border-color: #e74c3c;
}

.p-btn.urgent.active {
  background: #e74c3c;
  color: #fff;
}

.edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.save-btn {
  flex: 1;
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
  border: none;
  color: #fff;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: transform 0.2s;
}

.save-btn:hover {
  transform: translateY(-1px);
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #a0aec0;
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>
