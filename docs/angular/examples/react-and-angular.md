# Building Angular and React Applications Together With Nx

Large companies often use multiple frontend frameworks to build their products. One product can be built with Angular, another one with React. These products, even though are built by different teams using different stacks, often share components and utilities.

Setting this up traditionally is challenging. Companies put a lot of effort in making sure teams can collaborate and use each other's work. Nx drastically simplifies this.

To show how Nx does it, let's build two applications (one in Angular, and one in React) that will use a library of shared web components.

## Creating a New Nx Workspace

Let's start by creating a new Nx workspace. The easiest way to do this is to use npx.

```bash
npx --ignore-existing create-nx-workspace happynrwl --preset=empty
```

## Add Angular Capabilities

An empty workspace does not have any capabilities to create applications. Add capabilities for Angular development via:

```bash
npm i -D @nrwl/angular
```

## Creating an Angular Application

An empty workspace has no application or libraries: nothing to run and nothing to test. Let's add an Angular application into it via:

```bash
nx g @nrwl/angular:app angularapp
```

The result should look like this:

```treeview
happynrwl/
├── apps/
│   ├── angularapp/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── app.components.css
│   │   │   │   ├── app.components.html
│   │   │   │   ├── app.components.spec.ts
│   │   │   │   ├── app.components.ts
│   │   │   │   └── app.module.ts
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── polyfills.ts
│   │   │   ├── styles.scss
│   │   │   └── test.ts
│   │   ├── jest.conf.js
│   │   ├── tsconfig.app.json
│   │   ├── browserslist
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── tslint.json
│   └── angularapp-e2e/
├── libs/
├── README.md
├── angular.json
├── nx.json
├── package.json
├── tools/
├── tsconfig.base.json
└── tslint.json
```

The generated `main.ts`, will look as follows:

```typescript
import { enableProdMode } from '@angular/core';

import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));
```

And the template of the generated component will look as follows:

```html
<div style="text-align:center">
  Welcome to {{title}}!
  <img
    width="300"
    src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png"
    alt="Nx - Smart, Extensible Build Framework"
  />
</div>

<p>This is an Angular app built with <a href="https://nx.dev">Nx</a>.</p>
```

## Adding React Capabilities

Generating a React application is just as easy. First, add capabilities for React development via:

```bash
npm i -D @nrwl/react
```

## Creating a React Application

Create a React application via:

`nx g @nrwl/react:app reactapp` and this is what we will see:

```treeview
happynrwl/
├── apps/
│   ├── angularapp/
│   ├── angularapp-e2e/
│   ├── reactapp/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── app.css
│   │   │   │   ├── app.spec.tsx
│   │   │   │   └── app.tsx
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── polyfills.ts
│   │   │   ├── styles.scss
│   │   │   └── test.ts
│   │   ├── browserslist
│   │   ├── jest.conf.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── tslint.json
│   └── reactapp-e2e/
├── libs/
├── README.md
├── angular.json
├── nx.json
├── package.json
├── tools/
├── tsconfig.base.json
└── tslint.json
```

Where `main.ts` looks like this:

```typescript
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { App } from './app/app';

ReactDOM.render(<App />, document.querySelector('happynrwl-root'));
```

and `app.tsx` contains the following component:

```typescript jsx
import * as React from 'react';
import { Component } from 'react';

import './app.css';

export class App extends Component {
  render() {
    const title = 'reactapp';
    return (
      <div>
        <div style={{ textAlign: 'center' }}>
          <h1>Welcome to {title}!</h1>
          <img
            width="300"
            src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png"
          />
        </div>
        <p>
          This is a React app built with <a href="https://nx.dev">Nx</a>.
        </p>
      </div>
    );
  }
}
```

Nx provides a uniform tool for development the commands used for React development are the same as the commands used to develop Angular applications.

- `nx serve reactapp` serves the React app
- `nx build reactapp` builds the React app
- `nx test reactapp` tests the React app using Jest
- `nx e2e reactapp-e2e` tests the React app using Cypress

TypeScript support, Jest, Cypress, source maps, watch mode--all work with React out of the box. If we run ng serve reactapp, we will see the following:

![serve screenshot](/assets/content/angular/examples/react-serve.png)

## Creating Shared Components

Nx makes sharing code between applications easy. What used to take days or even weeks, with Nx takes minutes. Say we want to create a ui library of shared components that we will use in both the React and Angular applications.

`nx g @nrwl/workspace:lib ui` and this is what we will see:

```treeview
happynrwl/
├── apps/
│   ├── angularapp/
│   ├── angularapp-e2e/
│   ├── reactapp/
│   └── reactapp-e2e/
├── libs/
│   └── ui
│       ├── src/
│       │   ├── lib/
│       │   └── index.ts
│       ├── jest.conf.js
│       ├── tsconfig.lib.json
│       ├── tsconfig.json
│       ├── tsconfig.spec.json
│       └── tslint.json
├── README.md
├── angular.json
├── nx.json
├── package.json
├── tools/
├── tsconfig.base.json
└── tslint.json
```

Let's create a `greeting.element.ts` in the lib folder:

```typescript
export class GreetingElement extends HTMLElement {
  public static observedAttributes = ['title'];

  attributeChangedCallback() {
    this.innerHTML = `<h1>Welcome to ${this.title}!</h1>`;
  }
}

customElements.define('happynrwl-greeting', GreetingElement);
```

and reexport it in the `index.ts` file:

```typescript
export * from './lib/greeting.element';
```

The updated library should look like this

```treeview
happynrwl/
├── apps/
└── libs/
    └── ui
        ├── src/
        │   ├── lib/
        │   │   └── greeting.element.ts
        │   └── index.ts
        ├── jest.conf.js
        ├── tsconfig.lib.json
        ├── tsconfig.json
        ├── tsconfig.spec.json
        └── tslint.json
```

## Using the Greeting Element in our Angular App

### Importing the Library

Next, let's include the new library.

```typescript
import '@happynrwl/ui'; // <-- the new library

import { enableProdMode } from '@angular/core';

import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));
```

### Registering CUSTOM_ELEMENTS_SCHEMA

Next, let's register the `CUSTOM_ELEMENTS_SCHEMA` schema, which will tell the Angular compiler not to error when seeing non-standard element tags in components' templates.

```typescript
@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  providers: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

### Using the Greeting Element

Finally, we can update `app.component.html` to use our shared web component.

```html
<div style="text-align:center">
  <happynrwl-greeting [title]="title"></happynrwl-greeting>
  <img
    width="300"
    src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png"
    alt="Nx - Smart, Extensible Build Framework"
  />
</div>

<p>This is an Angular app built with <a href="https://nx.dev">Nx</a>.</p>
```

## Using the Greeting Element in our React App

Using Greeting in the react app requires similar steps.

### Importing Library

Next, let's include the new library in `main.ts`.

```typescript jsx
import '@happynrwl/ui';

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { App } from './app/app';

ReactDOM.render(<App />, document.querySelector('happynrwl-root'));
```

### Adding Intrinsic Types

Instead of registering `CUSTOM_ELEMENTS_SCHEMA`, let's add `intrinsic.d.ts file`, which serves a similar purpose to `CUSTOM_ELEMENTS_SCHEMA`, next to `main.tsx`.

```typescript
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
```

### Using the Greeting Element

Finally, we can update `app.tsx` to use our shared web component.

```typescript jsx
import * as React from 'react';
import { Component } from 'react';

import './app.css';

export class App extends Component {
  render() {
    const title = 'reactapp';
    return (
      <div>
        <div style={{ textAlign: 'center' }}>
          <happynrwl-greeting title={title} />
          <img
            width="300"
            src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png"
          />
        </div>
        <p>
          This is a React app built with <a href="https://nx.dev">Nx</a>.
        </p>
      </div>
    );
  }
}
```

## Nx Intelligence

What we have shown is already quite remarkable. We built two applications in two different framework using a shared library of web components. We can use same commands to serve, build, test the applications.

But Nx can do a lot more than that.

If we run `yarn dep-graph`, we will see the following:

![serve screenshot](/assets/content/angular/examples/react-dep-graph.png)

Nx understands how our applications and libraries depend on each other. This is extremely important! To really improve the collaboration between teams and make sure that they can use each other's work, the following two things must be true:

- If the Angular team makes a change to the Angular app itself. Only the Angular app has to be rebuilt and retested. Same is true for the React team. Any tool that requires us to rebuild and retest everything on every PR won't scale beyond a small repository.
- If any of the teams changes the ui library, both the Angular and the React applications should be rebuilt and retested before the PR gets merged into main. This is the only way to guarantee that the PR is safe to merge.

To see how Nx helps with this, let's commit the changes we have made so far.

```bash
git add .
git commit -am 'great commit'
```

Next, let's create a new branch `git checkout -b angularchange`. In this branch, let's introduce any change to app.component.html and run `yarn nx affected:dep-graph`.

![serve screenshot](/assets/content/angular/examples/react-affected.png)

As you can see, Nx knows that this change only affects the `angularapp` and nothing else. Nx can use this information to rebuild and retest only the angularapp:

```bash
yarn nx affected --target test # only tests angularapp
yarn nx affected --target build # only builds angularapp
```

Now, let's introduce a change to `greeting.element.ts` and run `yarn nx affected:dep-graph`.

![serve screenshot](/assets/content/angular/examples/react-affected2.png)

Both `angularapp` and `reactapp` are affected by this change because they both depend on the greeting component.

```bash
yarn nx affected --target test # tests ui, angularapp, reactapp
yarn nx affected --target build # only builds angularapp, reactapp
```

This is what we just saw:

- If we only touch our code, we only have to retest and rebuild our code.
- If we touch something that affects other teams, we'll have to rebuild and retest their applications as well.

Because this is a simple example, the impact is easily deductible. But a real workspace can have a dozen applications and hundred of libraries. Ad-hoc solutions do not work at such scale--we need tools like Nx, that can help us manage those workspaces.

## Summary

With Nx, we can build multiple applications using different frontend frameworks in the same workspace. These applications can share components, services, utilities. In this example we looked at a library of web components that we used in Angular and React applications. But we could go further: we could build the shared component using Angular Elements and then use it in the React application. Nx also allows us to build the backend next to our frontend and share code between them.

Nx analyses the code base to figure out how libraries and applications depend on each other. This analysis happens across frameworks and across client-server boundaries.

## Example App

You can find the example application [here](https://github.com/nrwl/nx-angular-and-react).
