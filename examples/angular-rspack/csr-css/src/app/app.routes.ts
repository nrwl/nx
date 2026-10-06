import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  // Lazy route so the build emits a non-initial chunk; with
  // subresourceIntegrity enabled this exercises the SRI importmap.
  {
    path: 'lazy',
    loadComponent: () =>
      import('./lazy/lazy.component').then((m) => m.LazyComponent),
  },
];
