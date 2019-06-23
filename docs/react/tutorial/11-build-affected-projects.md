# Step 11: Build Affected Projects

## Build Affected Apps

**Once again, make a change to `libs/ui/src/lib/todos/todos.tsx`:**

```typescript jsx
{
  props.todos.map(t => <li className={'todo'}>{t.title} !!</li>);
}
```

**Run `npm run affected:build`**

Nx will rebuild `todos` app. Why didn't it rebuild `ui`?

By default, Nx only builds libraries in the context of an application.

## Affected:\*

You can run any target against the affected projects in the graph like this:

```bash
# The following are equivalent
npm run affected -- --target=build
npm run affected:build
```

!!!!!
Run "npm run affected -- --target=invalid --base=master". What do you see?
!!!!!
No projects to run invalid
An error message saying that the "invalid" target is invalid
