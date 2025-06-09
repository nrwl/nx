#### Migrate Imports of `provideServerRendering` from `@angular/platform-server` to `@angular/ssr`

Migrate the imports of `provideServerRendering` from `@angular/platform-server` to `@angular/ssr`. This migration will also add the `@angular/ssr` package to your dependencies if needed.

#### Examples

Change the import of `provideServerRendering` from `@angular/platform-server` to `@angular/ssr`:

{% tabs %}
{% tab label="Before" %}

```ts {% fileName="app/app.config.server.ts" highlightLines=[2] %}
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering()],
};
```

{% /tab %}

{% tab label="After" %}

```ts {% fileName="app/app.config.server.ts" highlightLines=[2] %}
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/ssr';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering()],
};
```

{% /tab %}
{% /tabs %}

If you already have imports from `@angular/ssr`, the migration will add `provideServerRendering` to the existing import:

{% tabs %}
{% tab label="Before" %}

```ts {% fileName="app/app.config.server.ts" highlightLines=[2,3] %}
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { provideServerRouting } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(), provideServerRouting(serverRoutes)],
};
```

{% /tab %}

{% tab label="After" %}

```ts {% fileName="app/app.config.server.ts" highlightLines=[2] %}
import { ApplicationConfig } from '@angular/core';
import { provideServerRouting, provideServerRendering } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(), provideServerRouting(serverRoutes)],
};
```

{% /tab %}
{% /tabs %}
