#### Replace Usage of `getJestProjects` with `getJestProjectsAsync`

Replaces the usage of the deprecated `getJestProjects` function with the `getJestProjectsAsync` function.

#### Sample Code Changes

##### Before

```ts title="jest.config.ts"
import { getJestProjects } from '@nx/jest';

export default {
  projects: getJestProjects(),
};
```

##### After

```ts title="jest.config.ts"
import { getJestProjectsAsync } from '@nx/jest';

export default async () => ({
  projects: await getJestProjectsAsync(),
});
```
