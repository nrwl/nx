# Step 8: Create Libs

Libraries are not just a way to share code in Nx. They are also useful for factoring out code into small units with a well-defined public API.

## Public API

Every library has an `index.ts` file, which defines its public API. Other applications and libraries should only access what the `index.ts` exports. Everything else in the library is private.

## UI Libraries

To illustrate how useful libraries can be, create a library of Angular components.

**Run `ng g @nrwl/angular:lib ui`.**

You should see the following:

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
├── libs/
│   ├── data/
│   └── ui/
│       ├── jest.conf.js
│       ├── src/
│       │   ├── lib/
│       │   │   ├── ui.module.spec.ts
│       │   │   └── ui.module.ts
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

The `libs/ui/src/lib/ui.module.ts` file looks like this:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [CommonModule]
})
export class UiModule {}
```

## Add a Component

**Add a component to the newly created ui library by running:**

```bash
ng g component todos --project=ui --export
```

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
├── libs/
│   ├── data/
│   └── ui/
│       ├── jest.conf.js
│       ├── src/
│       │   ├── lib/
│       │   │   ├── todos/
│       │   │   │   ├── todos.component.css
│       │   │   │   ├── todos.component.html
│       │   │   │   ├── todos.component.spec.ts
│       │   │   │   └── todos.component.ts
│       │   │   ├── ui.module.spec.ts
│       │   │   └── ui.module.ts
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

**Add a `todos` input to `libs/src/lib/todos/todos.component.ts`.**

```typescript
import { Component, OnInit, Input } from '@angular/core';
import { Todo } from '@myorg/data';

@Component({
  selector: 'myorg-todos',
  templateUrl: './todos.component.html',
  styleUrls: ['./todos.component.css']
})
export class TodosComponent implements OnInit {
  @Input() todos: Todo[];

  constructor() {}

  ngOnInit() {}
}
```

**And update `todos.component.html` to display the given todos:**

```html
<ul>
  <li *ngFor="let t of todos">{{ t.title }}</li>
</ul>
```

## Use the UI Library

**Now import `UiModule` into `apps/todos/src/app/app.module.ts`.**

```typescript
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';
import { UiModule } from '@myorg/ui';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, HttpClientModule, UiModule],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
```

**And update `app.component.html`:**

```html
<h1>Todos</h1>

<myorg-todos [todos]="todos"></myorg-todos>

<button (click)="addTodo()">Add Todo</button>
```

**Restart both `ng serve api` and `ng serve todos` and you should see the application running.**

## Libraries usage

You can use libraries across the app using two strategies:

1. **Eager Load**: Loads the lib when the app is bootstrapped.
2. **Lazy Loading**: Loads only when the app required it.

#### Eager Loading

A good example was the usage of the `ui` library created previously. The lib was called directly on the `app.module.ts`

#### Lazy Loading

You can check the feature-shell usage:

## Feature Shell Libraries

To illustrate how to use lazy load strategy for libraries, create a library of Angular components.

**Run `ng g lib feature-shell --router --lazy`, and select Angular as the library framework.**

_**Explanation**_

- _**--routing**: Add router configuration. See lazy for more information._

- _**--lazy**: Add RouterModule.forChild when set to true, and a simple array of routes when set to false._

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
├── libs/
│   ├── data/
│   ├── ui/
│   └── feature-shell/
│       ├── jest.conf.js
│       ├── src/
│       │   ├── lib/
│       │   │  ├── feature-shell.module.spec.ts
│       │   │  └── feature-shell.module.ts
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

The `feature-shell.module.ts` file looks like this:

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

## Add Component

**Add a component to the newly created feature-shell library by running:**

```bash
ng g component main --project=feature-shell
```

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
├── libs/
│   ├── data/
│   └── ui/
│   └── feature-shell/
│       ├── jest.conf.js
│       ├── src/
│       │   ├── lib/
│       │   │  ├── main/
│       │   │  │   ├── main.component.css
│       │   │  │   ├── main.component.html
│       │   │  │   ├── main.component.spec.ts
│       │   │  │   └── main.component.ts
│       │   │  ├── feature-shell.module.spec.ts
│       │   │  └── feature-shell.module.ts
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

**Update the `FeatureShellModule` to use the `main` component**

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MainComponent } from './main/main.component';

@NgModule({
  imports: [
    CommonModule,

    RouterModule.forChild([
      { path: '', pathMatch: 'full', component: MainComponent }
    ])
  ]
})
export class FeatureShellModule {}
```

## Use Feature Shell Library

**Update the `AppModule` to have a Router Module definition into it using the `loadChildren` property**

```typescript
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';
import { UiModule } from '@myorg/ui';

// You can add multiple routes as your needs
const routes: Routes = [
  { path: 'main', loadChildren: '@myorg/feature-shell#FeatureShellModule' }
];

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    UiModule,
    RouterModule.forRoot(routes)
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
```

_**Explanation**: LoadChildren property receives a string of the form path/to/file#exportName that acts as a URL for a set of routes to load, or a function that returns such a set._

**And update `app.component.html`:**

```html
<router-outlet></router-outlet>
```

**Register the `feature-shell` lib public api on the `tsconfig.app.json` located under `apps/todos` folder to be include when the compilation process starts:**

```typescript
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc/apps/todos",
    "types": []
  },
  "exclude": [
    "src/test-setup.ts",
    "**/*.spec.ts"
  ],
  "include": [
    "**/*.ts",
    "../../libs/feature-shell/src/index.ts"
  ]
}
```

**Restart `ng serve todos` and go to `localhost:port/main` you should see the application running**

**Open the network panel on the browser, and check that the lib was lazy loaded.**

!!!!!
Libraries' public API is defined in...
!!!!!
index.ts
angular.json and tsconfig.json files
