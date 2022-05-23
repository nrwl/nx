# Advanced Angular Micro Frontends with Dynamic Module Federation

Dynamic Module Federation is a technique that allows an application to determine the location of its remote applications at runtime. It helps to achieve the use case of **“Build once, deploy everywhere”**.

“Build once, deploy everywhere” is the concept of being able to create a single build artefact of your application and deploy it to multiple environments such as staging and production.

The difficulty in achieving this with a Micro Frontend Architecture using Static Module Federation is that our Remote applications will have a different location (or URL) in each environment. Previously, to account for this, we would have had to specify the deployed location of the Remote applications and rebuild the application for the target environment.

This guide will walk through how the concept of “Build once, deploy everywhere” can be easily achieved in a Micro Frontend Architecture that uses Dynamic Module Federation.

## Aim

The aim of this guide is three-fold. We want to be able to:

- Set up a Micro Frontend with Static Module Federation
- Transform an existing Static Module Federation setup to use Dynamic Federation
- Generate a new Micro Frontend application that uses Dynamic Federation

## What we’ll build

To achieve the aims, we will do the following:

- Create a Static Federation Micro Frontend Architecture
- Change the Dashboard application to use Dynamic Federation
- Generate a new Employee Dashboard application that will use Dynamic Federation
  - It should use the existing Login application.
  - It should use a new Todo application.

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

### Creating our applications

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

The application generator will create and modify the files needed to set up the Angular application.

Now, let's generate the Login application as a remote application.

```bash
# Npm
npx nx g @nrwl/angular:remote login --host=dashboard
```

```bash
# Yarn
yarn nx g @nrwl/angular:remote login --host=dashboard
```

_**Note:** We provided `--host=dashboard` as an option. This tells the generator that this remote application will be consumed by the Dashboard application. The generator will automatically link these two applications together in the `module-federation.config.js` that gets used in the `webpack.config.js`._

_**Note**: The `RemoteEntryModule` generated will be imported in `app.module.ts` file, however, it is not used in the `AppModule` itself. This is to allow TS to find the Module during compilation, allowing it to be included in the built bundle. This is required for the Module Federation Plugin to expose the Module correctly. You can choose to import the `RemoteEntryModule` in the `AppModule` if you wish, however, it is not necessary._

## What was generated?

Let's take a closer look after generating each application.

For both applications, the generator did the following:

- Created the standard Angular application files
- Added a `module-federation.config.js` file
- Added a `webpack.config.js` and `webpack.prod.config.js`
- Added a `bootstrap.ts` file
- Moved the code that is normally in `main.ts` to `bootstrap.ts`
- Changed `main.ts` to dynamically import `bootstrap.ts` _(this is required for the Module Federation to correct load versions of shared libraries)_
- Updated the `build` target in the `project.json` to use the `@nrwl/angular:webpack-browser` executor _(this is required as it supports passing a custom Webpack configuration to the Angular compiler)_
- Updated the `serve` target to use `@nrwl/angular:webpack-server` _(this is required as we first need Webpack to build the application with our custom Webpack configuration)_

The key differences reside within the configuration of the Module Federation Plugin within each application's `module-federation.config.js`.

We see the following within Login's micro frontend configuration:

```js
module.exports = {
  name: 'login',
  exposes: {
    './Module': 'apps/login/src/app/remote-entry/entry.module.ts',
  },
};
```

Taking a look at each property of the configuration in turn:

- `name` is the name that Webpack assigns to the remote application. It **must** match the name of the application.
- `exposes` is the list of source files that the remote application provides consuming shell applications for their own use.

This config is then used in the `webpack.config.js` file:

```js
const { withModuleFederation } = require('@nrwl/angular/module-federation');
const config = require('./module-federation.config');
module.exports = withModuleFederation(config);
```

We can see the following in Dashboard's micro frontend configuration:

```js
module.exports = {
  name: 'dashboard',
  remotes: ['login'],
};
```

The key difference to note with the Dashboard's configuration is the `remotes` array. This is where you list the remote applications you want to consume in your host application.

You give it a name that you can reference in your code, in this case `login`. Nx will find where it is served.

Now that we have our applications generated, let's move on to building out some functionality for each.

## Adding Functionality

We'll start by building the Login application, which will consist of a login form and some very basic and insecure authorization logic.

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

We can see if we navigate a browser to `http://localhost:4201` that we see the login form rendered.

If we type in the correct username and password _(demo, demo)_, then we can also see the user gets authenticated!

Perfect! Our login application is complete.

### Dashboard Application

Now let's create the Dashboard application where we'll hide some content if the user is not authenticated. If the user is not authenticated, we will present them with the Login application where they can log in.

For this to work, the state within `UserService` must be shared across both applications. Usually, with Module Federation in Webpack, you have to specify the packages to share between all the applications in your Micro Frontend solution.  
However, by taking advantage of Nx's project graph, Nx will automatically find and share the dependencies of your applications.

_**Note:** This helps to enforce a single version policy and reduces the risk of [Micro Frontend Anarchy](https://www.thoughtworks.com/radar/techniques/micro-frontend-anarchy)_

Now, let's delete the `app.component.html` and `app.component.css` files in the Dashboard application. They will not be needed for this tutorial.

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

We can run both the dashboard application and the login application and you can try it out using:

```bash
nx serve dashboard --devRemotes=login
```

This concludes the setup required for a Micro Frontend approach using Static Module Federation.

## Converting the Dashboard application

The Dashboard application is a Host application that loads the Remote applications at runtime based on their deployed locations when the application was built using Static Module Federation.

We want to change this so that the Dashboard application can make a network request at runtime to find out the deployed locations of the Remote applications.

There are 3 steps involved with this:

- Make a network request to fetch the locations of the Remote applications _(the Remote Definitions)_.
- Set the Remote Definitions so that webpack is aware of how to find the Remote applications when requested.
- Change how we load the Remote applications so that webpack can fetch any required files correctly.

### Fetch and Set the Remote Definitions

Perhaps one of the easiest methods of fetching the Remote Definitions at runtime is to store them in a JSON file that can be present in each environment. The Host application then only has to make a GET request to the JSON file.

We’ll start by creating this file. Add a `module-federation.manifest.json` file to the `src/assets/` folder in our Dashboard application with the following content:

```json
{
  "login": "http://localhost:4201"
}
```

Next, open `main.ts` under the `src/`folder and replace it with the following:

```typescript
import { setRemoteDefinitions } from '@nrwl/angular/mfe';

fetch('/assets/module-federation.manifest.json')
  .then((res) => res.json())
  .then((definitions) => setRemoteDefinitions(definitions))
  .then(() => import('./bootstrap').catch((err) => console.error(err)));
```

You’ll notice that we:

- Fetch the JSON file
- Call `setRemoteDefinitions` with the contents of the JSON file
  - This tells webpack where each of our Remote applications has been deployed to!

### Change how Remotes are loaded

At the moment, webpack is statically building our application, telling it at build time where our Remotes are. That is because they are specified in the `module-federation.config.js` file.

Open the `module-federation.config.js` file at the root of our `apps/dashboard/` folder and set the `remotes` property to be an empty array. It should look like this:

```javascript
module.exports = {
  name: 'dashboard',
  remotes: [],
};
```

Next, we need to change how our application attempts to load the Remote when it is routed to. Open `app.module.ts` under the `src/app/`folder.

You should see the following line in the `RouterModule.forRoot()`:

```typescript
{
    path: 'login',
    loadChildren: () =>
       import('login/Module').then((m) => m.RemoteEntryModule),
}
```

Replace it with the following:

```typescript
{
    path: 'login',
    loadChildren: () =>
        loadRemoteModule('login', './Module').then(
            (m) => m.RemoteEntryModule
         ),
}
```

You will also need to add the following import to the top of the file:

```typescript
import { loadRemoteModule } from '@nrwl/angular/mfe';
```

The `loadRemoteModule` helper method simply hides some logic that will check if the Remote application has been loaded, and if not, load it, and then requests the correct exposed module from it.

### Summary

That’s all the changes required to replace Static Module Federation with Dynamic Module Federation.

Running:

```bash
nx serve dashboard --devRemotes=login
```

Should result in the same behaviour as before, except that our Dashboard application is waiting until runtime to find out the deployed location of our Login application.

In the next section, we will see how Nx’s generators can be used to automate a lot of this process for us!

---

## Creating a new Dynamic Host application

Nx provides generators that aim to streamline the process of setting up a Dynamic Micro Frontend architecture.

To showcase this, let’s create a new Host application that will use our previous Login application as well as a new Todo Remote application.

### Generate the Employee Host application

Run the following command to generate a new Host application that is preconfigured for Dynamic Federation and add specify the Login Remote application we want to add:

```bash
nx g @nrwl/angular:host employee --remotes=login --dynamic
```

This will generate:

- Angular application
- Webpack Configuration _(webpack.config.js)_
- Module Federation Configuration _(module-federation.config.js)_
- Micro Frontend Manifest File _(module-federation.manifest.json)_
- Changes to the bootstrap of application to fetch the Micro Frontend Manifest, set the Remote Definitions and load the Login application correctly

You should take a look at the files generated and see how the Login Remote application was added to the `module-federation.manifest.json` file and the slight changes to `main.ts` and `app.module.ts` to load the Remotes dynamically.

### Generate the Todo Remote application

We’re going to demonstrate how when specifying a dynamic Host when adding a new Remote application, the Remote application will be added to the Host’s Micro Frontend Manifest file correctly.

```bash
nx g @nrwl/angular:remote todo --host=employee
```

You’ll note that this will generate the same output as the Login Remote application in the previous guide. There’s one difference.

Because the Host application is using Dynamic Federation, the new Remote will be added to the Host’s `module-federation.manifest.json`.

### Summary

Dynamic Federation is the perfect way to solve the problem of **“Build once, deploy everywhere”**. It can be used in tandem with CD solutions that involve spinning up environments for different stages of the release process without having to rebuild the application at all. The CD pipeline only ever needs to replace a JSON file on that environment with one that contains the correct values for the deployed locations of the remote applications.
