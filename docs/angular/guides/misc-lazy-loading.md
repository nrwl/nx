# Lazy Loading Libraries

You can use libraries across the app using two strategies:

1. **Eager Loading**: Loads libs when the app is bootstrapped.
2. **Lazy Loading**: Loads libs when the app needs them.

### Lazy Loading

Even a medium size application has code that doesn't need to load until later. Lazing loading this code help with the bundle size, as a a result, with the startup time of your application.

To learn how to use lazy loading, run `ng g @nrwl/angular:lib todo-list-shell --routing --lazy --parentModule=apps/todos/src/app/app.module.ts`.

_**Explanation**_

- **--routing**: Add router configuration.

- **--lazy**: Add `RouterModule.forChild` when set to true, and a simple array of routes when set to false.

- **--parentModule**: Updates the parent module.

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
├── libs/
│   └── todo-list-shell/
│       ├── jest.conf.js
│       ├── src/
│       │   ├── lib/
│       │   │  ├── todo-list-shell.module.spec.ts
│       │   │  └── todo-list-shell.module.ts
│       │   └── index.ts
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       ├── tsconfig.spec.json
│       └── tslint.json
├── nx.json
├── package.json
├── tools/
├── tsconfig.json
└── tslint.json
```

`todo-list-shell.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@NgModule({
  imports: [
    CommonModule,

    RouterModule.forChild([
      /* {path: '', pathMatch: 'full', component: InsertYourComponentHere} */
    ])
  ]
})
export class FeatureShellModule {}
```

### Add Component

Now add a component to the newly created todo-list-shell library:

```bash
ng g component main --project=todo-list-shell
```

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
├── libs/
│   └── todo-list-shell/
│       ├── jest.conf.js
│       ├── src/
│       │   ├── lib/
│       │   │  ├── todo-list/
│       │   │  │   ├── todo-list.component.css
│       │   │  │   ├── todo-list.component.html
│       │   │  │   ├── todo-list.component.spec.ts
│       │   │  │   └── todo-list.component.ts
│       │   │  ├── todo-list-shell.module.spec.ts
│       │   │  └── todo-list-shell.module.ts
│       │   └── index.ts
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       ├── tsconfig.spec.json
│       └── tslint.json
├── nx.json
├── package.json
├── tools/
├── tsconfig.json
└── tslint.json
```

Next, update the `TodoListShellModule` to use the component:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TodoListComponent } from './todo-list/todo-list.component';

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild([
      { path: '', pathMatch: 'full', component: TodoListComponent }
    ])
  ]
})
export class TodoListShellModule {}
```

### Changes in AppModule

The schematic already modified `app.module.ts` by adding a lazy route with the loadChildren property.

```typescript
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';

// You can add multiple routes as your needs
const routes: Routes = [
  {
    path: 'list',
    loadChildren: () =>
      import('@myorg/todo-list-shell').then(m => m.TodoListShellModule)
  }
];

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, RouterModule.forRoot(routes)],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
```
