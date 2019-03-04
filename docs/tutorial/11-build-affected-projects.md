# Step 11: Build Affected Projects

## Build Affected Apps

**Once again make a change to `todos.component.html`:**

```html
<ul>
  <li *ngFor="let t of todos">{{ t.title }}!!!</li>
</ul>
```

**Run `npm run affected:build -- --base=master`**

Nx will rebuild `todos` app. Why didn't it rebuild `ui`?

By default, Nx build libraries in the context of some application. You can change it if you mark a library as `publishable`.

## Affected:\*

You can run any target against the affected projects in the graph like this:

```bash
npm run affected -- --target=build --base=master
```

!!!!!
Run "npm run affected -- --target=invalid --base=master". What do you see?
!!!!!
No projects to run invalid
An error message saying that the "invalid" target is invalid
