import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'remote',
    loadChildren: () =>
      // @ts-expect-error
      import('examples-angular-rspack-mf-remote/Routes').then(
        (m) => m!.remoteRoutes
      ),
  },
];
