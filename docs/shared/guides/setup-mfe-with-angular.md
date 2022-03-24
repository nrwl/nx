# How to setup a Micro Frontend with Angular and Nx

[Webpack 5](https://webpack.js.org/blog/2020-10-10-webpack-5-release/) introduced a [Module Federation Plugin](https://webpack.js.org/concepts/module-federation/#modulefederationplugin-high-level) enabling multiple, independently built and deployed bundles of code to form a single application. This is the foundation of Micro Frontend Architecture and the Module Federation Plugin makes implementing such an architecture much simpler.  
With Angular 12 adding support for Webpack 5 it increases the viability of scaffolding a Micro Frontend architecture with Angular.

We have added some generators to aid in the scaffolding of Module Federation configuration required for setting up a Micro Frontend Architecture.

Therefore, using Nx, it can be fairly straightforward to scaffold and build a Micro Frontend Architecture from a monorepo with all the additional benefits of Nx.

In this guide, we'll show you to how setup a Micro Frontend Architecture with Nx and Angular.

> **NOTE**: When serving Micro-Frontends (_MFEs_) in dev mode locally, there'll be an error output to the console: `import.meta cannot be used outside of a module`, and the script that is coming from is `styles.js`. It's a known error output, but it doesn't actually cause any breakages from as far as our testing has shown. It's because the Angular compiler attaches the `styles.js` file to the `index.html` in a `<script>` tag with `defer`.
>
> It needs to be attached with `type=module`, but doing so breaks HMR. There is no way of hooking into that process for us to patch it ourselves.
>
> The good news is that the error doesn't propagate to production, because styles are compiled to a CSS file, so there's no erroneous JS to log an error.
>
> It's worth reiterating that there's been no actual errors or breakages noted from our tests.

## What we'll build

We will put together a simple Admin Dashboard application that requires a user to log in to view the protected content.  
To achieve this we will have two apps:

- Admin Dashboard app
  - This will contain the layout of the dashboard and the content that can only be viewed by an authenticated and authorized user.
- Login app
  - This will contain the forms and logic for authenticating and authorizing a user

When the user tries to view a protected page within the Admin Dashboard, if they are not authenticated we will present them with a login form so that they can authenticate and view the contents of the page.

The end result should look something like this:

## First steps

### Create an Nx Workspace

To start with, we need to create a new Nx Workspace. We can do this easily with:

```bash
# Npm
npx create-nx-workspace ng-mfe
```

```bash
# Yarn
yarn create nx-workspace ng-mfe --packageManager=yarn
```

You'll be prompted for a preset. We recommend selecting `empty` as it will allow you finer control over your workspace configuration.

You'll also be prompted if you would like to setup Nx Cloud. For this tutorial select `No`, however, I highly recommend that you read more about it [here](https://nx.app/).

### Add the Angular Plugin

To add Angular-related features to our newly created monorepo we need to install the Angular Plugin. Again, this is pretty easy to do:

_**NOTE:** Check that you are now at the root of your monorepo in your terminal. If not, run `cd ng-mfe`_

```bash
# Npm
npm install --save-dev @nrwl/angular
```

```bash
# Yarn
yarn add -D @nrwl/angular
```

Simple! You are now able to use Nx Generators to scaffold Angular applications and libraries.

### Creating our apps

We need to generate two applications that support Module Federation.

We'll start with the Admin Dashboard application which will act as a host application for the Micro-Frontends (_MFEs_):

```bash
# Npm
npx nx g @nrwl/angular:host dashboard
```

```bash
# Yarn
yarn nx g @nrwl/angular:host dashboard
```

The application generator will create and modify the files needed to setup the Angular application.

Now, let's generate the Login application as a remote application.

```bash
# Npm
npx nx g @nrwl/angular:remote login --host=dashboard
```

```bash
# Yarn
yarn nx g @nrwl/angular:remote login --host=dashboard
```

_**Note:** We provided `--host=dashboard` as an option. This tells the generator that this remote app will be consumed by the Dashboard application. The generator will automatically link these two apps together in the `webpack.config.js`_

_**Note**: The `RemoteEntryModule` generated will be imported in `app.module.ts` file, however, it is not used in the `AppModule` itself. This it to allow TS to find the Module during compilation, allowing it to be included in the built bundle. This is required for the Module Federation Plugin to expose the Module correctly. You can choose to import the `RemoteEntryModule` in the `AppModule` if you wish, however, it is not necessary._

## What was generated?

Let's take a closer after generating each application.

For both apps, the generator did the following:

- Created the standard Angular application files
- Added a `webpack.config.js` and `webpack.prod.config.js`
- Added a `bootstrap.ts` file
- Moved the code that is normally in `main.ts` to `bootstrap.ts`
- Changed `main.ts` to dynamically import `bootstrap.ts` _(this is required for the Module Federation to correct load versions of shared libraries)_
- Updated the `build` target in the `project.json` to use the `@nrwl/angular:webpack-browser` executor _(this is required as it supports passing a custom webpack configuration to the Angular compiler)_
- Updated the `serve` target to use `@nrwl/angular:webpack-server`. _(this is required as we first need webpack to build the app with our custom webpack config)_

The key differences reside within the configuration of the Module Federation Plugin within each app's `webpack.config.js`.

We see the following within Login's webpack configuration:

```js
const { withModuleFederation } = require('@nrwl/angular/module-federation');
module.exports = withModuleFederation({
  name: 'login',
  exposes: {
    './Module': 'apps/login/src/app/remote-entry/entry.module.ts',
  },
});
```

Taking a look at each property of the configuration in turn:

- `name` is the name that Webpack assigns to the remote appliction. It **must** match the name of the application.
- `exposes` is the list of source files that the remote application provides consuming shell applications for their own use.

We can see the following in Dashboard's webpack configuration:

```js
const { withModuleFederation } = require('@nrwl/angular/module-federation');
module.exports = withModuleFederation({
  name: 'dashboard',
  remotes: ['login'],
});
```

The key difference to note with the Dashboard's configuration is the `remotes` array. This is where you list the remote applications you want to consume in your host application.

You give it a name that you can reference in your code, in this case `login`. Nx will find where it is served.

Now that we have our applications generated, let's move on to building out some functionality for each.

## Adding Functionality

We'll start by building the Login app, which will consist of a login form and some very basic and insecure authorization logic.

### User Library

Let's create a user data-access library that will be shared between the host application and the remote application. This will be used to determine if there is an authenticated user as well as providing logic for authenticating the user.

```bash
nx g @nrwl/angular:lib shared/data-access-user
```

This will scaffold a new library for us to use.

We need an Angular Service that we will use to hold state:

```bash
nx g @nrwl/angular:service user --project=shared-data-access-user
```

This will create a file `user.service.ts` under the `shared/data-access-user` library. Change it's contents to match:

```ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserService {
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

Add a new export to the shared/data-access-user's `index.ts` file:  
`export * from './lib/user.service';`

## Login Application

First, add `FormsModule` to the `imports` array in your `remote-entry/entry.module.ts` file:

```ts
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { RemoteEntryComponent } from './entry.component';

@NgModule({
  declarations: [RemoteEntryComponent],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild([
      {
        path: '',
        component: RemoteEntryComponent,
      },
    ]),
  ],
  providers: [],
})
export class RemoteEntryModule {}
```

Next we want to set up our `entry.component.ts` file so that it renders a login and has injected our `UserService` to allow us to sign the user in:

```ts
import { Component } from '@angular/core';
import { UserService } from '@ng-mfe/shared/data-access-user';

@Component({
  selector: 'ng-mfe-login-entry',
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
export class RemoteEntryComponent {
  username = '';
  password = '';

  isLoggedIn$ = this.userService.isUserLoggedIn$;

  constructor(private userService: UserService) {}

  login() {
    this.userService.checkCredentials(this.username, this.password);
  }
}
```

_**Note:** This could be improved with error handling etc. but for the purposes of this tutorial, we'll keep it simple._

Let's add a route to our Login application so that we can render the `RemoteEntryComponent`.  
Open `app.module.ts` and add the following route to the `RouterMoodule.forRoot(...)` declaration.

```ts
RouterModule.forRoot(
  [
    {
      path: '',
      loadChildren: () =>
        import('./remote-entry/entry.module').then((m) => m.RemoteEntryModule),
    },
  ],
  { initialNavigation: 'enabledBlocking' }
);
```

Now let's serve the application and view it in a browser to check that the form renders correctly.

```bash
nx run login:serve
```

We can see if we navigate a browser to `http://localhost:4201` that we see the login form rendered:

![Login App](/shared/guides/login-app.png)

If we type in the correct username and password _(demo, demo)_, then we can also see the user gets authenticated!

Perfect! Our login application is complete.

### Dashboard Application

Now let's create the Dashboard application where we'll hide some content if the user is not authenticated. If the user is not authenticated, we will present them with the Login application where they can log in.

For this to work, the state within `UserService` must be shared across both applications. Usually with Module Federation in webpack, you have to specifiy the packages to share between all the apps in your Micro Frontend solution.  
However, by taking advantage of Nx's project graph, Nx will automatically find and share the dependencies of your applications.

_**Note:** This helps to enforce a single version policy and reduces the risk of [Micro Frontend Anarchy](https://www.thoughtworks.com/radar/techniques/micro-frontend-anarchy)_

Now, let's delete the `app.component.html` and `app.component.css` files in the Dashboard app. They will not be needed for this tutorial.

Finally, let's add our logic to `app.component.ts`. Change it to match the following:

```ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { distinctUntilChanged } from 'rxjs/operators';

import { UserService } from '@ng-mfe/shared/data-access-user';

@Component({
  selector: 'ng-mfe-root',
  template: `
    <div class="dashboard-nav">Admin Dashboard</div>
    <div *ngIf="isLoggedIn$ | async; else signIn">
      You are authenticated so you can see this content.
    </div>
    <ng-template #signIn><router-outlet></router-outlet></ng-template>
  `,
  styles: [``],
})
export class AppComponent implements OnInit {
  isLoggedIn$ = this.userService.isUserLoggedIn$;

  constructor(private userService: UserService, private router: Router) {}

  ngOnInit() {
    this.isLoggedIn$
      .pipe(distinctUntilChanged())
      .subscribe(async (loggedIn) => {
        if (!loggedIn) {
          this.router.navigateByUrl('login');
        } else {
          this.router.navigateByUrl('');
        }
      });
  }
}
```

We can run both the dashboard app and the login app and you can try it out using:

```bash
nx run dashboard:serve-mfe
```

## Conclusion

As you can see, with this approach, your Login application can be deployed independently and developed independently without forcing you to have to rebuild or redeploy your Dashboard application. This can lead to a powerful micro frontend architecture that enables multiple teams to work independently in a single monorepo!

In this tutorial, we exposed a single module that was consumed dynamically as an Angular Route.

## References and Further Reading

- Module Federation: https://webpack.js.org/concepts/module-federation/
- Mirco Frontend Revolution Article Series: https://www.angulararchitects.io/aktuelles/the-microfrontend-revolution-module-federation-in-webpack-5/
