import { Lesson } from './course.types';

export function calculateTotalDuration(lessons: Lesson[]): string {
  const totalMinutes = lessons.reduce((total, lesson) => {
    if (!lesson.duration) return total;
    const [minutes, seconds] = lesson.duration.split(':').map(Number);
    return total + minutes + seconds / 60;
  }, 0);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
