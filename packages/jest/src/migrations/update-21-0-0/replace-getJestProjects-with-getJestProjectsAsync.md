#### Replace Usage of `getJestProjects` with `getJestProjectsAsync`

Replaces the usage of the removed `getJestProjects` function with the `getJestProjectsAsync` function.

#### Sample Code Changes

{% tabs %}
{% tab label="Before" %}

```ts {% fileName="jest.config.ts" %}
import { getJestProjects } from '@nx/jest';

export default {
  projects: getJestProjects(),
};
```

{% /tab %}
{% tab label="After" %}

```ts {% fileName="jest.config.ts" %}
import { getJestProjectsAsync } from '@nx/jest';

export default async () => ({
  projects: await getJestProjectsAsync(),
});
```

{% /tab %}
{% /tabs %}
