import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// Figures referenced from docs pages via {% figure name="..." /%}. Lazy, so a
// page only loads Motion and the code of the figures it embeds.
//
// The figure code is generated: nrwl/content-animations apps/blog-figures is
// the source of truth, synced here with its sync script. Only this file,
// InteractiveFigure.tsx and README.md are owned by the docs.
export const FIGURES: Record<string, LazyExoticComponent<ComponentType>> = {
  'task-affected': lazy(() => import('./TaskAffected')),
  'critical-path': lazy(() => import('./CriticalPath')),
  'task-profiles': lazy(() => import('./TaskProfiles')),
  'task-packing': lazy(() => import('./TaskPacking')),
  'worker-scaling': lazy(() => import('./WorkerScaling')),
  ultracache: lazy(() => import('./Ultracache')),
  atomization: lazy(() => import('./Atomization')),
  benchmarks: lazy(() => import('./Benchmarks')),
};

export const FIGURE_NAMES = Object.keys(FIGURES);
