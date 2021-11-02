# React Nx Tutorial - Step 11: Test Affected Projects

<iframe width="560" height="315" src="https://www.youtube.com/embed/_mBBFRjs01g" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

In addition to supporting computation caching, Nx scales your development by doing code change analysis to see what is affected by a particular pull request.

**Commit all the changes in the repo**:

```bash
git add .
git commit -am 'init'
git checkout -b testbranch
```

**Open `libs/ui/src/lib/todos/todos.tsx` and change the component:**

```typescript
import React from 'react';
import { Todo } from '@myorg/data';

export const Todos = (props: { todos: Todo[] }) => {
  return (
    <ul>
      {props.todos.map((t) => (
        <li className={'todo'}>{t.title}!!</li>
      ))}
    </ul>
  );
};

export default Todos;
```

**Run `npx nx affected:apps`**, and you should see `todos` printed out. The `affected:apps` looks at what you have changed and uses the dependency graph to figure out which apps can be affected by this change.

**Run `npx nx affected:libs`**, and you should see `ui` printed out. This command works similarly, but instead of printing the affected apps, it prints the affected libs.

## Test Affected Projects

Printing the affected projects can be handy, but usually you want to do something with them. For instance, you may want to test everything that has been affected.

**Run `npx nx affected:test` to retest only the projects affected by the change.**

As you can see, since we updated the code, without updating the tests, the unit tests failed.

```bash
>  NX  Running target test for projects:

  - ui
  - todos

...

  Failed projects:

  - todos
  - ui
```

Note that Nx only tried to retest `ui` and `todos`. It didn't retest `api` or `data` because there is no way that could be affected by the changes in this branch.

## Affected:\*

You can run any target against the affected projects in the graph like this:

```bash
# The following are equivalent
npx nx affected --target=build
npx nx affected:build
```
