# Angular Nx Tutorial - Step 11: Testing Affected Projects

<iframe width="560" height="315" src="https://www.youtube.com/embed/5t77CPl-bbM" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

Because Nx understands the dependency graph of your workspace, Nx is efficient at retesting and rebuilding your projects.

**Commit all the changes in the repo**:

```bash
git add .
git commit -am 'init'
git checkout -b testbranch
```

**Open `libs/ui/src/lib/todos/todos.component.html` and change the template:**

```html
<ul>
  <li *ngFor="let t of todos" class="todo">{{ t.title }}!</li>
</ul>
```

Run the command to see affected apps.

```sh
npx nx affected:apps
```

You should see `todos` printed out. The `affected:apps` looks at what you have changed and uses the dependency graph to figure out which apps can be affected by this change.

Run the command to see affected libraries

```sh
npx nx affected:libs
```

You should see `ui` printed out. This command works similarly, but instead of printing the affected apps, it prints the affected libs.

## Test affected projects

Printing the affected projects can be handy, but usually you want to do something with them. For instance, you may want to test everything that has been affected.

Run the command to retest only the projects affected by the change:

```sh
npx nx affected:test
```

You will see the following:

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

Run the command to retest the failed projects.

```sh
npx nx affected:test -- --only-failed
```

## Affected:

You can run any target against the affected projects in the graph like this:

```bash
# The following are equivalent
npx nx affected --target=build
npx nx affected:build
```

## What's Next

- Continue to [Step 12: Summary](/angular-tutorial/12-summary)
