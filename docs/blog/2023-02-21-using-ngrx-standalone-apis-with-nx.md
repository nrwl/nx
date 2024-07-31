---
title: 'Using NgRx Standalone APIs with Nx'
slug: 'using-ngrx-standalone-apis-with-nx'
authors: ['Colum Ferry']
cover_image: '/blog/images/2023-02-21/1*pJHhA04d6jIjOb5vpCDjyw.png'
tags: [nx, tutorial]
---

Version 15 of [NgRx](https://ngrx.io/) introduced Standalone APIs to the package, enabling usage of the NgRx with Standalone Component-based [Angular](https://angular.io/) applications. This allows for a simpler integration of NgRx to your application.

Nx has added support for using these Standalone APIs from NgRx when generating NgRx stores with our `@nrwl/angular:ngrx` generator when you give it a path to a `Routes` definition file. _(Usually denoted by_ `_*.routes.ts_`_)_

In this article, we’ll walk through using Nx to create a new Standalone Component-based Angular application and add NgRx to it, using _ONLY_ Nx Generators!

**Prefer a video version? We’ve got you covered!**

{% youtube src="https://www.youtube.com/watch?v=fp9E5G9C61Q" /%}

## Create a new Nx Workspace

`npx create-nx-workspace myorg`

Select:

- Standalone Angular app
- Yes to using Standalone Components
- Yes to add routing
- Any option for the stylesheet format
- Yes to Nx Cloud

The result should look something like this:

![](/blog/images/2023-02-21/0*-91CdqmMaqFjMDVK.avif)

Now run `cd myorg` to enter the workspace.

The `src/main.ts` should look different than you remember with standard NgModule-based Angular applications.

You should see something similar to

```
import { bootstrapApplication } from '@angular/platform-browser';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
} from '@angular/router';
import { AppComponent } from './app/app.component';
import { appRoutes } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: \[provideRouter(appRoutes, withEnabledBlockingInitialNavigation())\],
}).catch((err) => console.error(err));
```

This is important, as this is the file where your root NgRx providers need to be placed, within the `providers` option of the `bootstrapApplication` function.

Nx will aid this also!

## Generate the root state

`nx g @nrwl/angular:ngrx --root --parent=src/main.ts`

You’ll be asked for a name for the feature state, but you can ignore this and simply press enter in your terminal, it is not necessary at this stage.

Say false to Facades also.

![](/blog/images/2023-02-21/0*6igpc5F6dk9UMswf.avif)

The generator will now make changes to your `main.ts` file and install the NgRx packages for you!

Your `main.ts` file should now look like this

```
import { bootstrapApplication } from '@angular/platform-browser';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
} from '@angular/router';
import { AppComponent } from './app/app.component';
import { appRoutes } from './app/app.routes';
import { provideStore, provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';

bootstrapApplication(AppComponent, {
  providers: \[
    provideEffects(),
    provideStore(),
    provideRouter(appRoutes, withEnabledBlockingInitialNavigation()),
  \],
}).catch((err) => console.error(err));
```

Notice the addition of `provideEffects()` and `provideStore()` to the `providers` array.

## Generate a new feature library

NgRx works better when you split your store based on the features you have within your application. This is a pretty common use case. Nx allows you to do this very easily and in a very structured way.

First, let’s generate a new feature library, called `feature-users`, in Nx that will house everything related to our feature including the NgRx State.

`nx g @nrwl/angular:lib feature-users --standalone --routing --lazy --parent=src/app/app.routes.ts`

This command does a few things:

- It creates a new library in our Nx Workspace
- It uses an Angular Standalone Component as the entrypoint
- It adds a routing configuration to the library and adds the component as the default route.
- It will add a lazy-loaded route to the application’s `app.routes.ts` file, wiring up the application to the library!

Some files you may want to explore in your own time are:

`src/app/app.routes.ts`  
`feature-users/src/lib/lib.routes.ts`

## Add feature state to the feature library

Now that we have a feature library for our users feature, let’s generate the feature state! It’s as simple as one command.

`nx g @nrwl/angular:ngrx users --parent=feature-users/src/lib/lib.routes.ts --route=''`

You’ll be asked if this is the root state of the application, enter `N`. Then say no to Facades (unless you really want them).

The `--route` option here is used to dictate what `route` within our routes definition file (`lib.routes.ts`) should have the state attached to it. This is to allow the NgRx Standalone APIs to be attached to that route.

We can see that if we look at the `lib.routes.ts` file

```
import { Route } from '@angular/router';
import { FeatureUsersComponent } from './feature-users/feature-users.component';
import { provideStore, provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import \* as fromUsers from './+state/users.reducer';
import { UsersEffects } from './+state/users.effects';

export const featureUsersRoutes: Route\[\] = \[
  {
    path: '',
    component: FeatureUsersComponent,
    providers: \[
      provideState(fromUsers.USERS\_FEATURE\_KEY, fromUsers.usersReducer),
      provideEffects(UsersEffects),
    \],
  },
\];
```

The command will also have generated our

- Actions
- Reducers
- Selectors
- Effects

And with that, we now have NgRx installed and integrated into our application!

If you’d like to confirm the integration, you can run the following commands and see successful outputs!

`nx build`

`nx test`

`nx test feature-users`

## Conclusion

This guide has shown how easy it is to set up NgRx with Nx and how to take advantage of the latest Standalone APIs with your application. All with just 5 Nx commands!

With the Angular roadmap pointing to Standalone Components becoming the preferred option for developing Angular applications, this support will be crucial in the future, and Nx will help you achieve it with the best possible DX!

> Btw, did you know you can now scaffold a single-project Angular Nx workspace that fully leverages the Standalone APIs? Check it out here: [https://youtu.be/Hi3aJ0Rlkls](https://youtu.be/Hi3aJ0Rlkls)

You can check out an example repository that was created following the steps above here: [https://github.com/Coly010/nx-ngrx-standalone](https://github.com/Coly010/nx-ngrx-standalone)

## Learn More

🧠 [Nx Docs](/getting-started/intro)  
👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)  
💬 [Nx Official Discord Server](https://go.nx.dev/community)
📹 [Nrwl Youtube Channel](https://www.youtube.com/@nxdevtools)  
🥚 [Free Egghead course](https://egghead.io/courses/scale-react-development-with-nx-4038)  
🧐 [Need help with Angular, React, Monorepos, Lerna or Nx? Talk to us 😃](https://nx.app/enterprise)
