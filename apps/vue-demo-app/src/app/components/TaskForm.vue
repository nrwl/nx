<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TaskPriority } from '../models';

const emit = defineEmits<{
  submit: [data: { title: string; description: string; priority: TaskPriority; tags: string[] }];
}>();

const titleInputRef = ref<HTMLInputElement | null>(null);

const isExpanded = ref(false);
const taskTitle = ref('');
const description = ref('');
const priority = ref<TaskPriority>('medium');
const tagsInput = ref('');

const parsedTags = computed(() =>
{
  return tagsInput.value
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
});

const resetForm = () =>
{
  taskTitle.value = '';
  description.value = '';
  priority.value = 'medium';
  tagsInput.value = '';
};

const toggleForm = () =>
{
  isExpanded.value = !isExpanded.value;
  if(!isExpanded.value)
  {
    resetForm();
  }
};

const focusTitleTemplateRef = (input: HTMLInputElement | null) =>
{
  input?.focus();
};

const focusTitleRef = () =>
{
  titleInputRef.value?.focus();
};

const handleSubmit = () =>
{
  if(!taskTitle.value.trim()) return;

  emit('submit', {
    title: taskTitle.value.trim(),
    description: description.value.trim(),
    priority: priority.value,
    tags: parsedTags.value
  });

  resetForm();
  isExpanded.value = false;
};

const handleKeyUp = (e: KeyboardEvent) =>
{
  if(e.key === 'Enter')
  {
    handleSubmit();
  }
};

const setPriority = (p: TaskPriority) =>
{
  priority.value = p;
};
</script>

<template>
  <div class="form-wrapper">
    <button
      class="add-btn"
      @click="toggleForm"
    >
      <template v-if="isExpanded">
        ✕ Cancel
      </template>
      <template v-else>
        + New Task
      </template>
    </button>

    <div
      v-if="isExpanded"
      class="form-panel"
    >
      <div class="form-group">
        <label>Title *</label>
        <input
          ref="titleInputRef"
          v-model="taskTitle"
          type="text"
          placeholder="What needs to be done?"
          @keyup="handleKeyUp"
        >
      </div>

      <div class="form-group">
        <label>Description</label>
        <textarea
          v-model="description"
          placeholder="Add more details..."
        />
      </div>

      <div class="form-group">
        <label>Priority</label>
        <div class="priority-selector">
          <button
            class="priority-btn low"
            :class="{ selected: priority === 'low' }"
            @click="setPriority('low')"
          >
            Low
          </button>
          <button
            class="priority-btn medium"
            :class="{ selected: priority === 'medium' }"
            @click="setPriority('medium')"
          >
            Medium
          </button>
          <button
            class="priority-btn high"
            :class="{ selected: priority === 'high' }"
            @click="setPriority('high')"
          >
            High
          </button>
          <button
            class="priority-btn urgent"
            :class="{ selected: priority === 'urgent' }"
            @click="setPriority('urgent')"
          >
            Urgent
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>Tags (comma-separated)</label>
        <input
          v-model="tagsInput"
          type="text"
          placeholder="frontend, bug, feature..."
        >
        <div
          v-if="parsedTags.length > 0"
          class="tag-preview"
        >
          <span
            v-for="tag in parsedTags"
            :key="tag"
            class="tag"
          >{{ tag }}</span>
        </div>
      </div>

      <button
        class="submit-btn"
        @click="handleSubmit"
      >
        Create Task
      </button>
      <button
        class="submit-btn"
        @click="focusTitleTemplateRef(titleInputRef)"
      >
        Focus Title (Template Ref)
      </button>
      <button
        class="submit-btn"
        @click="focusTitleRef"
      >
        Focus Title (Ref)
      </button>
    </div>
  </div>
</template>

<style scoped>
.form-wrapper {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 20px;
}

.add-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: #fff;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: transform 0.2s, box-shadow 0.2s;
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.form-panel {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  color: #a0aec0;
  font-size: 0.9rem;
  font-weight: 500;
}

.form-group input,
.form-group textarea {
  padding: 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 1rem;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: #718096;
}

.form-group textarea {
  min-height: 80px;
  resize: vertical;
}

.priority-selector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.priority-btn {
  padding: 8px 16px;
  border: 2px solid transparent;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.1);
  color: #a0aec0;
}

.priority-btn.low {
  border-color: #718096;
}

.priority-btn.low.selected {
  background: #718096;
  color: #fff;
}

.priority-btn.medium {
  border-color: #48bb78;
}

.priority-btn.medium.selected {
  background: #48bb78;
  color: #fff;
}

.priority-btn.high {
  border-color: #f39c12;
}

.priority-btn.high.selected {
  background: #f39c12;
  color: #fff;
}

.priority-btn.urgent {
  border-color: #e74c3c;
}

.priority-btn.urgent.selected {
  background: #e74c3c;
  color: #fff;
}

.tag-preview {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.tag {
  background: rgba(102, 126, 234, 0.2);
  color: #a5b4fc;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.8rem;
}

.submit-btn {
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
  border: none;
  color: #fff;
  padding: 14px 28px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-top: 8px;
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(39, 174, 96, 0.4);
}
</style>
