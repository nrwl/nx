#### Replace `provideServerRouting` and `provideServerRoutesConfig` with `provideServerRendering`

Replace `provideServerRouting` and `provideServerRoutesConfig` calls with `provideServerRendering` using `withRoutes`.

#### Examples

Remove `provideServerRouting` from your providers array and update the `provideServerRendering` call to use `withRoutes`:

##### Before

```ts title="app/app.config.server.ts" {2,6}
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering, provideServerRouting } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(), provideServerRouting(serverRoutes)],
};
```

##### After

```ts title="app/app.config.server.ts" {2,6}
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};
```

If you have `provideServerRouting` with additional arguments, the migration will preserve them:

##### Before

```ts title="app/app.config.server.ts" {4,11,12}
import { ApplicationConfig } from '@angular/core';
import {
  provideServerRendering,
  provideServerRouting,
  withAppShell,
} from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideServerRouting(serverRoutes, withAppShell(AppShellComponent)),
  ],
};
```

##### After

```ts title="app/app.config.server.ts" {2,7-10}
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering, withAppShell, withRoutes } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(
      withRoutes(serverRoutes),
      withAppShell(AppShellComponent)
    ),
  ],
};
```

Remove `provideServerRoutesConfig` from your providers array and update the `provideServerRendering` call to use `withRoutes`:

##### Before

```ts title="app/app.config.server.ts" {4,11,12}
import { ApplicationConfig } from '@angular/core';
import {
  provideServerRendering,
  provideServerRoutesConfig,
  withAppShell,
} from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideServerRoutesConfig(serverRoutes, withAppShell(AppShellComponent)),
  ],
};
```

##### After

```ts title="app/app.config.server.ts" {2,7-10}
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering, withAppShell, withRoutes } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(
      withRoutes(serverRoutes),
      withAppShell(AppShellComponent)
    ),
  ],
};
```
