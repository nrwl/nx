import { NestedComponent } from './nested.component';

export const nestedRoutes = [
  {
    path: '',
    component: NestedComponent,
    children: [
      {
        path: 'child-a',
        loadComponent: () =>
          import('./child-a/child-a.component').then((m) => m.ChildAComponent),
      },
      {
        path: 'child-b',
        loadComponent: () =>
          import('./child-b/child-b.component').then((m) => m.ChildBComponent),
      },
    ],
  },
];
