// nx-ignore-next-line
import type { TaskGraph } from 'nx/src/devkit-exports';

// TODO: (chau) replace with nx import
export interface TaskGraphClientResponse {
  taskGraph: TaskGraph;
  error?: string | null;
  plans?: Record<string, string[]>;
}
