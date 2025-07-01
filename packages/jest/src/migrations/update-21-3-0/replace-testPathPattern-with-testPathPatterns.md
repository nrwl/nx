#### Replace Usage of `testPathPattern` with `testPathPatterns`

Replaces the usage of the removed `testPathPattern` flag with the `testPathPatterns` flag.

#### Sample Code Changes

{% tabs %}
{% tab label="Before" %}

```ts {% fileName="jest.config.ts" %}
import { getJestProjects } from '@nx/jest';

export default {
  // ...other config
  testPathPattern: "unit/.*",
};
```

{% /tab %}
{% tab label="After" %}

```ts {% fileName="jest.config.ts" %}
export default {
  // ...other config
  testPathPatterns: "unit/.*",
};
```

{% /tab %}
{% /tabs %}
