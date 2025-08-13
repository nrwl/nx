import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'bar',
    loadComponent: () =>
      import('./bar/bar.component').then((m) => m.BarComponent),
  },
  {
    path: 'nested',
    loadChildren: () =>
      import('./nested/nested.routes').then((m) => m.nestedRoutes),
  },
];
