# Step 11: Build Affected Projects

## Build Affected Apps

**Once again, make a change to `libs/ui/src/lib/ui.ts`:**

```typescript
this.innerHTML = `<ul>${this._todos
  .map(t => `<li class="todo">${t.title} !!!</li>`)
  .join('')}</ul>`;
```

**Run `nx affected:build`**

Nx will rebuild `todos` app. Why didn't it rebuild `ui`?

By default, Nx only builds libraries in the context of an application.

## Affected:\*

You can run any target against the affected projects in the graph like this:

```bash
# The following are equivalent
nx affected --target=build
nx affected:build
```

!!!!!
Run "nx affected --target=invalid --base=master". What do you see?
!!!!!
No affected projects to run target "invalid" on
An error message saying that the "invalid" target is invalid
