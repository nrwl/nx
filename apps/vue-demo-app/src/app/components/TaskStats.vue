<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { TaskStats } from '../models';

const props = defineProps<{
  stats: TaskStats;
}>();

const currentTime = ref(new Date().toLocaleTimeString());
let intervalId: ReturnType<typeof setInterval> | null = null;

const completionPercent = computed(() =>
{
  if(props.stats.total === 0) return 0;
  return Math.round((props.stats.byStatus.done / props.stats.total) * 100);
});

const urgentAndHighCount = computed(() =>
{
  return props.stats.byPriority.urgent + props.stats.byPriority.high;
});

onMounted(() =>
{
  intervalId = setInterval(() =>
  {
    currentTime.value = new Date().toLocaleTimeString();
  }, 1000);
});

onUnmounted(() =>
{
  if(intervalId !== null)
  {
    clearInterval(intervalId);
  }
});
</script>

<template>
  <div class="stats-panel">
    <div class="stat-card completion">
      <div class="stat-icon">
        ✅
      </div>
      <div class="stat-content">
        <span class="stat-value">{{ completionPercent }}%</span>
        <span class="stat-label">Completed</span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: completionPercent + '%' }"
        />
      </div>
    </div>

    <div class="stat-card status">
      <div class="stat-icon">
        📋
      </div>
      <div class="stat-content">
        <div class="stat-row">
          <span class="dot todo" />
          <span>To Do: {{ stats.byStatus['todo'] }}</span>
        </div>
        <div class="stat-row">
          <span class="dot in-progress" />
          <span>In Progress: {{ stats.byStatus['in-progress'] }}</span>
        </div>
        <div class="stat-row">
          <span class="dot done" />
          <span>Done: {{ stats.byStatus['done'] }}</span>
        </div>
      </div>
    </div>

    <div class="stat-card priority">
      <div class="stat-icon">
        🎯
      </div>
      <div class="stat-content">
        <span class="stat-value">{{ urgentAndHighCount }}</span>
        <span class="stat-label">High Priority</span>
      </div>
    </div>

    <div class="stat-card alerts">
      <div class="stat-icon">
        ⚠️
      </div>
      <div class="stat-content">
        <div
          v-if="stats.overdue > 0"
          class="alert-item overdue"
        >
          <span class="alert-count">{{ stats.overdue }}</span>
          <span>Overdue</span>
        </div>
        <div
          v-if="stats.dueToday > 0"
          class="alert-item due-today"
        >
          <span class="alert-count">{{ stats.dueToday }}</span>
          <span>Due Today</span>
        </div>
        <span
          v-if="stats.overdue === 0 && stats.dueToday === 0"
          class="all-clear"
        >All clear! 🎉</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-panel {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 900px) {
  .stats-panel {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 500px) {
  .stats-panel {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-icon {
  font-size: 1.5rem;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
}

.stat-label {
  font-size: 0.9rem;
  color: #a0aec0;
}

.progress-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #27ae60, #2ecc71);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e2e8f0;
  font-size: 0.9rem;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot.todo {
  background: #e74c3c;
}

.dot.in-progress {
  background: #f39c12;
}

.dot.done {
  background: #27ae60;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #fff;
}

.alert-item.overdue {
  background: rgba(231, 76, 60, 0.2);
}

.alert-item.due-today {
  background: rgba(243, 156, 18, 0.2);
}

.alert-count {
  font-weight: 700;
  font-size: 1.2rem;
}

.all-clear {
  color: #27ae60;
  font-size: 1rem;
}
</style>
