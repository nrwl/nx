#### Update AnalogJS 3.x import paths

Analog 3.0 removed `@analogjs/vite-plugin-angular/setup-vitest`. Setup imports now come from `@analogjs/vitest-angular`. This migration updates those deprecated import paths in Vite, Vitest, and test-setup files. Analog 2.x workspaces are left unchanged.

#### Sample code changes

##### Before

```ts title="src/test-setup.ts"
import '@analogjs/vite-plugin-angular/setup-vitest';
```

##### After

```ts title="src/test-setup.ts"
import '@analogjs/vitest-angular';
```
