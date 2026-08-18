#### Add `trustProxyHeaders` to SSR Engines

Angular v22 adds a `trustProxyHeaders` option to `AngularNodeAppEngine` and `AngularAppEngine` that controls whether the `X-Forwarded-*` headers are trusted when resolving the incoming request URL. This migration adds the option to existing engine instantiations in SSR server files so the behavior is explicit, along with a TODO comment flagging it as security-sensitive. Instantiations that already set `trustProxyHeaders` are left unchanged.

The migration scans the source files of projects that depend on `@angular/ssr` for `new AngularNodeAppEngine(...)` and `new AngularAppEngine(...)` expressions.

#### Examples

##### `server.ts`

Before:

```ts
import { AngularNodeAppEngine } from '@angular/ssr/node';

const angularApp = new AngularNodeAppEngine();
```

After:

```ts
import { AngularNodeAppEngine } from '@angular/ssr/node';

const angularApp = new AngularNodeAppEngine({
  // TODO: This is a security-sensitive option. Remove if not needed. For more information, see https://angular.dev/best-practices/security#configuring-trusted-proxy-headers
  trustProxyHeaders: ['x-forwarded-host', 'x-forwarded-proto'],
});
```

An existing options object is preserved, with `trustProxyHeaders` added alongside the current options:

Before:

```ts
const angularApp = new AngularAppEngine({
  allowedHosts: ['example.com'],
});
```

After:

```ts
const angularApp = new AngularAppEngine({
  // TODO: This is a security-sensitive option. Remove if not needed. For more information, see https://angular.dev/best-practices/security#configuring-trusted-proxy-headers
  trustProxyHeaders: ['x-forwarded-host', 'x-forwarded-proto'],
  allowedHosts: ['example.com'],
});
```
