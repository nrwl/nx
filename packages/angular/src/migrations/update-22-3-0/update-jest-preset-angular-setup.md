#### Update Jest Preset Angular Setup

Replaces the removed `jest-preset-angular/setup-jest` import with the new `setupZoneTestEnv` function from `jest-preset-angular/setup-env/zone`.

Starting with `jest-preset-angular` v15, the `setup-jest` files have been removed and replaced with explicit setup functions. The old `setup-jest` import only supported zone-based testing (zoneless support was added in v14.3.0 with the new `setupZonelessTestEnv` function), so all projects using the removed import are migrated to use `setupZoneTestEnv`.

#### Examples

##### Before

```ts title="apps/my-app/src/test-setup.ts"
import 'jest-preset-angular/setup-jest';
```

##### After

```ts title="apps/my-app/src/test-setup.ts"
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();
```
