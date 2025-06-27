---
title: Advanced Angular Micro Frontends with Dynamic Module Federation
description: Learn how to implement Dynamic Module Federation in Angular applications to achieve "Build once, deploy everywhere" with Nx, enabling runtime determination of remote application locations.
---

# Advanced Angular Micro Frontends with Dynamic Module Federation

Dynamic Module Federation is a technique that allows an application to determine the location of its remote applications at runtime. It helps to achieve the use case of **"Build once, deploy everywhere"**.

"Build once, deploy everywhere" is the concept of being able to create a single build artifact of your application and deploy it to multiple environments such as staging and production.

The difficulty in achieving this with a Micro Frontend Architecture using Static Module Federation is that our Remote applications will have a different location (or URL) in each environment. Previously, to account for this, we would have had to specify the deployed location of the Remote applications and rebuild the application for the target environment.

This guide will walk through how the concept of "Build once, deploy everywhere" can be easily achieved in a Micro Frontend Architecture that uses Dynamic Module Federation.

## Aim

The aim of this guide is three-fold. We want to be able to:

- Set up a Micro Frontend with Static Module Federation
- Transform an existing Static Module Federation setup to use Dynamic Federation
- Generate a new Micro Frontend application that uses Dynamic Federation

## What we'll build

To achieve the aims, we will do the following:

- Create a Static Federation Micro Frontend Architecture
- Change the **Dashboard** application to use Dynamic Federation
- Generate a new **Employee Dashboard** application that will use Dynamic Federation
  - It should use the existing **Login** application.
  - It should use a new **Todo** application.

## Final Code

Here's the source code of the final result for this guide.

{% github-repository url="https://github.com/Coly010/nx-ng-dyn-fed" /%}

## First steps

### Create an Nx Workspace

To start with, we need to create a new Nx Workspace and add the Nx Angular plugin. We can do this easily with:

{% tabs %}
{% tab label="npm" %}

```{% command="npx create-nx-workspace@latest ng-mf --preset=apps" path="~/" %}
 NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Which CI provider would you like to use? · skip
✔ Would you like remote caching to make your build faster? · skip

```

Next run:

```shell
cd ng-mf
npx nx add @nx/angular
```

{% /tab %}
{% tab label="yarn" %}

```{% command="yarn create nx-workspace ng-mf --preset=apps" path="~/" %}
 NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Which CI provider would you like to use? · skip
✔ Would you like remote caching to make your build faster? · skip

```

Next run:

```shell
cd ng-mf
yarn nx add @nx/angular
```

{% /tab %}
{% tab label="pnpm" %}

```{% command="pnpx create-nx-workspace@latest ng-mf --preset=apps" path="~/" %}
 NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Which CI provider would you like to use? · skip
✔ Would you like remote caching to make your build faster? · skip

```

Next run:

```shell
cd ng-mf
pnpx nx add @nx/angular
```

{% /tab %}
{% /tabs %}

### Creating our applications

We need to generate two applications that support Module Federation.

We'll start with the **Admin Dashboard** application which will act as a host application for the Micro-Frontends (_MFEs_):

```shell
nx g @nx/angular:host apps/dashboard --prefix=ng-mf
```

{% callout type="note" title="Running nx commands" %}
The terminal examples in this guide will show `nx` being run as if it is installed globally. If you have not installed Nx globally (not required), you can use your package manager to run the `nx` local binary:

- NPM: `npx nx ...`
- Yarn: `yarn nx ...`
- PNPM: `pnpm nx ...`

{% /callout %}

The `host` generator will create and modify the files needed to set up the Angular application.

Now, let's generate the **Login** application as a remote application that will be consumed by the **Dashboard** host application.

```shell
nx g @nx/angular:remote apps/login --prefix=ng-mf --host=dashboard
```

Note how we provided the `--host=dashboard` option. This tells the generator that this remote application will be consumed by the **Dashboard** application. The generator performed the following changes to automatically link these two applications together:

- Added the remote to the `apps/dashboard/module-federation.config.ts` file
- Added a TypeScript path mapping to the root tsconfig file
- Added a new route to the `apps/dashboard/src/app/app.routes.ts` file

## What was generated?

Let's take a closer look after generating each application.

For both applications, the generators did the following:

- Created the standard Angular application files
- Added a `module-federation.config.ts` file
- Added a `webpack.config.ts` and `webpack.prod.config.ts`
- Added a `src/bootstrap.ts` file
- Moved the code that is normally in `src/main.ts` to `src/bootstrap.ts`
- Changed `src/main.ts` to dynamically import `src/bootstrap.ts` _(this is required for the Module Federation to load versions of shared libraries correctly)_
- Updated the `build` target in the `project.json` to use the `@nx/angular:webpack-browser` executor _(this is required to support passing a custom Webpack configuration to the Angular compiler)_
- Updated the `serve` target to use `@nx/angular:dev-server` _(this is required as we first need Webpack to build the application with our custom Webpack configuration)_

The key differences reside within the configuration of the Module Federation Plugin within each application's `module-federation.config.ts`.

We can see the following in the **Login** micro frontend configuration:

```ts {% fileName="apps/login/module-federation.config.ts" %}
import { ModuleFederationConfig } from '@nx/webpack';

const config: ModuleFederationConfig = {
  name: 'login',
  exposes: {
    './Routes': 'apps/login/src/app/remote-entry/entry.routes.ts',
  },
};

export default config;
```

Taking a look at each property of the configuration in turn:

- `name` is the name that Webpack assigns to the remote application. It **must** match the name of the project.
- `exposes` is the list of source files that the remote application exposes to consuming shell applications for their own use.

This config is then used in the `webpack.config.ts` file:

```ts {% fileName="apps/login/webpack.config.ts" %}
import { withModuleFederation } from '@nx/angular/module-federation';
import config from './module-federation.config';

export default withModuleFederation(config, { dts: false });
```

We can see the following in the **Dashboard** micro frontend configuration:

```ts {% fileName="apps/dashboard/module-federation.config.ts" %}
import { ModuleFederationConfig } from '@nx/webpack';

const config: ModuleFederationConfig = {
  name: 'dashboard',
  remotes: ['login'],
};

export default config;
```

The key difference to note with the **Dashboard** configuration is the `remotes` array. This is where you list the remote applications you want to consume in your host application.

You give it a name that you can reference in your code, in this case `login`. Nx will find where it is served.

Now that we have our applications generated, let's move on to building out some functionality for each.

## Adding Functionality

We'll start by building the **Login** application, which will consist of a login form and some very basic and insecure authorization logic.

### User Library

Let's create a user data-access library that will be shared between the host application and the remote application.
This will be used to determine if there is an authenticated user as well as providing logic for authenticating the user.

```shell
nx g @nx/angular:lib libs/shared/data-access-user
```

This will scaffold a new library for us to use.

We need an Angular Service that we will use to hold state:

```shell
nx g @nx/angular:service user --project=data-access-user
```

This will create the `libs/shared/data-access-user/src/lib/user-auth.ts` file. Change its contents to match:

```ts {% fileName="libs/shared/data-access-user/src/lib/user-auth.ts" %}
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserAuth {
  private isUserLoggedIn = new BehaviorSubject(false);
  isUserLoggedIn$ = this.isUserLoggedIn.asObservable();

  checkCredentials(username: string, password: string) {
    if (username === 'demo' && password === 'demo') {
      this.isUserLoggedIn.next(true);
    }
  }

  logout() {
    this.isUserLoggedIn.next(false);
  }
}
```

Now, export the service in the library's entry point file:

```ts {% fileName="libs/shared/data-access-user/src/index.ts" %}
...
export * from './lib/user.service';
```

### Login Application

Let's set up our `entry.ts` file in the **Login** application so that it renders a login form. We'll import `FormsModule` and inject our `UserService` to allow us to sign the user in:

```ts {% fileName="apps/login/src/app/remote-entry/entry.ts" %}
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '@ng-mf/data-access-user';
import { inject } from '@angular/core';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'ng-mf-login-entry',
  template: `
    <div class="login-app">
      <form class="login-form" (ngSubmit)="login()">
        <label>
          Username:
          <input type="text" name="username" [(ngModel)]="username" />
        </label>
        <label>
          Password:
          <input type="password" name="password" [(ngModel)]="password" />
        </label>
        <button type="submit">Login</button>
      </form>
      <div *ngIf="isLoggedIn$ | async">User is logged in!</div>
    </div>
  `,
  styles: [
    `
      .login-app {
        width: 30vw;
        border: 2px dashed black;
        padding: 8px;
        margin: 0 auto;
      }
      .login-form {
        display: flex;
        align-items: center;
        flex-direction: column;
        margin: 0 auto;
        padding: 8px;
      }
      label {
        display: block;
      }
    `,
  ],
})
export class RemoteEntry {
  private userService = inject(UserService);
  username = '';
  password = '';
  isLoggedIn$ = this.userService.isUserLoggedIn$;

  login() {
    this.userService.checkCredentials(this.username, this.password);
  }
}
```

{% callout type="note" title="More details" %}
This could be improved with things like error handling, but for the purposes of this tutorial, we'll keep it simple.
{% /callout %}

Now let's serve the application and view it in a browser to check that the form renders correctly.

```shell
nx run login:serve
```

We can see if we navigate a browser to `http://localhost:4201` that we see the login form rendered.

If we type in the correct username and password _(demo, demo)_, then we can also see the user gets authenticated!

Perfect! Our **Login** application is complete.

### Dashboard Application

Now let's update our **Dashboard** application. We'll hide some content if the user is not authenticated, and present them with the **Login** application where they can log in.

For this to work, the state within `UserService` must be shared across both applications. Usually, with Module Federation in Webpack, you have to specify the packages to share between all the applications in your Micro Frontend solution. However, by taking advantage of Nx's project graph, Nx will automatically find and share the dependencies of your applications.

{% callout type="note" title="Single version policy" %}
This helps to enforce a single version policy and reduces the risk of [Micro Frontend Anarchy](https://www.thoughtworks.com/radar/techniques/micro-frontend-anarchy).
{% /callout %}

Start by deleting the `app.html`, `app.css`, and `nx-welcome.ts` files from the **Dashboard** application. They will not be needed for this tutorial.

Next, let's add our logic to the `app.ts` file. Change it to match the following:

```ts {% fileName="apps/dashboard/src/app/app.ts" %}
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '@ng-mf/data-access-user';
import { distinctUntilChanged } from 'rxjs/operators';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'ng-mf-root',
  template: `
    <div class="dashboard-nav">Admin Dashboard</div>
    <div *ngIf="isLoggedIn$ | async; else signIn">
      You are authenticated so you can see this content.
    </div>
    <ng-template #signIn><router-outlet></router-outlet></ng-template>
  `,
})
export class App implements OnInit {
  private router = inject(Router);
  private userService = inject(UserService);
  isLoggedIn$ = this.userService.isUserLoggedIn$;

  ngOnInit() {
    this.isLoggedIn$
      .pipe(distinctUntilChanged())
      .subscribe(async (loggedIn) => {
        // Queue the navigation after initialNavigation blocking is completed
        setTimeout(() => {
          if (!loggedIn) {
            this.router.navigateByUrl('login');
          } else {
            this.router.navigateByUrl('');
          }
        });
      });
  }
}
```

Finally, make sure the application routes are correctly set up:

```ts {% fileName="apps/dashboard/src/app/app.routes.ts" %}
import { Route } from '@angular/router';
import { App } from './app';

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadChildren: () => import('login/Routes').then((m) => m.remoteRoutes),
  },
  {
    path: '',
    component: App,
  },
];
```

We can now run both the **Dashboard** and **Login** applications:

```shell
nx serve dashboard --devRemotes=login
```

Navigating to `http://localhost:4200` should show the **Dashboard** application with the **Login** application embedded within it. If you log in, you should see the content change to show that you are authenticated.

This concludes the setup required for a Micro Frontend approach using Static Module Federation.

{% callout type="warning" title="Do not fret!" %}

When serving module federation apps locally in dev mode, there'll be an error output to the console: `import.meta cannot be used outside of a module`. You'll see the error originates from the `styles.js` script. It's a known error output, and as far as our testing has shown, it doesn't cause any breakages. It happens because the Angular compiler attaches the `styles.js` file to the `index.html` in a `<script>` tag with `defer`.

It needs to be attached with `type=module`, but Angular can't make that change because it breaks HMR. They also provide no way of hooking into that process for us to patch it ourselves.

The good news is that the error doesn't propagate to production because styles are compiled to a CSS file, so there's no erroneous JS to log an error.

It's worth stressing that no errors or breakages have been noted from our tests.

{% /callout %}

## Converting the Dashboard application

The **Dashboard** application is a Host application that loads the Remote applications at runtime based on their deployed locations when the application was built using Static Module Federation.

We want to change this so that the **Dashboard** application can make a network request at runtime to find out the deployed locations of the Remote applications.

There are 3 steps involved with this:

- Make a network request to fetch the locations of the Remote applications _(the Remote Definitions)_.
- Set the Remote Definitions so that webpack is aware of how to find the Remote applications when requested.
- Change how we load the Remote applications so that webpack can fetch any required files correctly.

### Fetch and Set the Remote Definitions

Perhaps one of the easiest methods of fetching the Remote Definitions at runtime is to store them in a JSON file that can be present in each environment. The Host application then only has to make a GET request to the JSON file.

We'll start by creating this file. Add a `module-federation.manifest.json` file to the `public/` folder in our **Dashboard** application with the following content:

```json {% fileName="apps/dashboard/public/module-federation.manifest.json" %}
{
  "login": "http://localhost:4201"
}
```

Next, open the `main.ts` file and replace it with the following:

```ts {% fileName="apps/dashboard/src/main.ts" %}
import { setRemoteDefinitions } from '@nx/angular/mf';

fetch('/module-federation.manifest.json')
  .then((res) => res.json())
  .then((definitions) => setRemoteDefinitions(definitions))
  .then(() => import('./bootstrap').catch((err) => console.error(err)));
```

You'll notice that we fetch the JSON file and provide its contents to the `setRemoteDefinitions` function we invoke next. This tells webpack where each of our remote applications has been deployed to!

### Change how Remotes are loaded

At the moment, webpack is statically building our application, telling it at build time where our Remotes are. That is because they are specified in the `module-federation.config.ts` file.

Open the `module-federation.config.ts` file at the root of our `apps/dashboard/` folder and set the `remotes` property to be an empty array. It should look like this:

```ts {% fileName="apps/dashboard/module-federation.config.ts" highlightLines=[5] %}
import { ModuleFederationConfig } from '@nx/webpack';

const config: ModuleFederationConfig = {
  name: 'dashboard',
  remotes: [],
};

export default config;
```

Next, we need to change how our application attempts to load the Remote when it is routed to. Open the `app.routes.ts` file under the `src/app/` folder and apply the following changes:

```ts {% fileName="apps/dashboard/src/app/app.routes.ts" highlightLines=[2, "8-9"] %}
import { Route } from '@angular/router';
import { loadRemoteModule } from '@nx/angular/mf';
import { App } from './app';

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadChildren: () =>
      loadRemoteModule('login', './Routes').then((m) => m.remoteRoutes),
  },
  {
    path: '',
    component: App,
  },
];
```

The `loadRemoteModule` helper method simply hides some logic that will check if the Remote application has been loaded, and if not, load it, and then requests the correct exposed routes from it.

### Summary

That's all the changes required to replace Static Module Federation with Dynamic Module Federation.

Running:

```shell
nx serve dashboard --devRemotes=login
```

Should result in the same behaviour as before, except that our **Dashboard** application is waiting until runtime to find out the deployed location of our **Login** application.

In the next section, we will see how Nx's generators can be used to automate a lot of this process for us!

---

## Creating a new Dynamic Host application

Nx provides generators that aim to streamline the process of setting up a Dynamic Micro Frontend architecture.

To showcase this, let's create a new Host application that will use our previous **Login** application as well as a new **Todo** Remote application.

### Generate the Employee Host application

Run the following command to generate a new Host application that is preconfigured for Dynamic Federation and add specify the **Login** Remote application we want to add:

```shell
nx g @nx/angular:host apps/employee --remotes=login --dynamic
```

This will generate:

- Angular application
- Webpack Configuration _(webpack.config.ts)_
- Module Federation Configuration _(module-federation.config.ts)_
- Micro Frontend Manifest File _(module-federation.manifest.json)_
- Changes to the bootstrap of application to fetch the Micro Frontend Manifest, set the Remote Definitions and load the **Login** application correctly

You should take a look at the files generated and see how the **Login** Remote application was added to the `module-federation.manifest.json` file and the slight changes to `main.ts` and `app.routes.ts` to load the Remotes dynamically.

### Generate the Todo Remote application

We're going to demonstrate how when specifying a dynamic Host when adding a new Remote application, the Remote application will be added to the Host's Micro Frontend Manifest file correctly.

```shell
nx g @nx/angular:remote apps/todo --host=employee
```

You'll note that this will generate the same output as the **Login** Remote application in the previous guide. There's one difference. Because the Host application is using Dynamic Federation, the new Remote will be added to the Host's `module-federation.manifest.json`.

### Summary

Dynamic Federation is the perfect way to solve the problem of **“Build once, deploy everywhere”**. It can be used in tandem with CD solutions that involve spinning up environments for different stages of the release process without having to rebuild the application at all. The CD pipeline only ever needs to replace a JSON file on that environment with one that contains the correct values for the deployed locations of the remote applications.
