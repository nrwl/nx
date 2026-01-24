#### Update Angular SSR Imports to Use Node Entry Point

Update '@angular/ssr' import paths to use the new '/node' entry point when 'CommonEngine' is detected.

#### Sample Code Changes

Update import paths for SSR CommonEngine properties to use `@angular/ssr/node`.

##### Before

```ts title="apps/app1/server.ts"
import { CommonEngine } from '@angular/ssr';
import type {
  CommonEngineOptions,
  CommonEngineRenderOptions,
} from '@angular/ssr';
```

##### After

```ts title="apps/app1/server.ts"
import { CommonEngine } from '@angular/ssr/node';
import type {
  CommonEngineOptions,
  CommonEngineRenderOptions,
} from '@angular/ssr/node';
```
