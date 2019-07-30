# Step 10: Test Affected Projects

Because Nx understands the dependency graph of your workspace, Nx can be efficient at retesting and rebuilding your projects.

**Commit all the changes in the repo**:

```bash
git add .
git commit -am 'init'
```

**Open `libs/ui/src/lib/todos/todos.tsx` and change the component:**

```typescript jsx
{
  props.todos.map(t => <li className={'todo'}>{t.title} !!</li>);
}
```

**Run `nx affected:apps`**, and you should see `todos` printed out. The `affected:apps` looks at what you have changed and uses the dependency graph to figure out which apps can be affected by this change.

**Run `nx affected:libs`**, and you should see `ui` printed out. This command works similarly, but instead of printing the affected apps, it prints the affected libs.

## Test Affected Projects

Printing the affected projects can be handy, but usually you want to do something with them. For instance, you may want to test everything that has been affected.

**Run `nx affected:test` to retest only the projects affected by the change.**

You will see the following:

```
Running test for projects:
 ui,
 todos

...

Running test for affected projects failed.
Failed projects: todos
You can isolate the above projects by passing --only-failed
```

One of the projects failed. Instead of retesting every single project on every change, pass `--only-failed` to only retest the failed ones.

**Run `nx affected:test --only-failed` to retest the failed projects.**

## Testing in Parallel

Some changes affect many projects in the repository. To speed up the testing of this change, pass `--parallel`.

**Run `nx affected:test --parallel` to test affected projects in parallel**

!!!!!
Check in the changes into master and run `nx affected:test`. What do you see?
!!!!!
No projects to run test
The `todos` project failed as before
`Cannot run tests against master` error
