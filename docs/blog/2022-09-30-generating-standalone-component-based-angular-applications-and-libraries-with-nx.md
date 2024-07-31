---
title: 'Generating Standalone Component-based Angular Applications and Libraries with Nx'
slug: 'generating-standalone-component-based-angular-applications-and-libraries-with-nx'
authors: ['Colum Ferry']
cover_image: '/blog/images/2022-09-30/1*h0pmKq38FJKyUSIZp14OCA.png'
tags: [nx, tutorial]
---

[Angular](https://angular.io/) recently released [Standalone Components](https://angular.io/guide/standalone-components) in an effort to address one of their highest voted community issues; to make `NgModule` optional.  
This was of course met with great excitement from the community, and it offers a much simpler approach to the development of Angular applications.

> Prefer a video version? We’ve got you covered! Check out our video on this:

{% youtube src="https://www.youtube.com/watch?v=e-BpE9d3NIw" /%}

Originally with Angular, we would bootstrap an `AppModule` that declared an `AppComponent` and this would be seen to be the root of our application. This was achieved by calling the `bootstrapModule` function in the `src/main.ts` file. However, as the goal was to make `NgModule` optional, Angular needed to create a method of bootstrapping a Standalone Component. Therefore, they created the `bootstrapApplication` function that allows for a Standalone Component to be bootstrapped, as well as allowing top-level providers such as Routing to be initialized from the `src/main.ts` file.

Despite now having an approach for building Angular applications with no `NgModules`, the Angular CLI does not yet provide a schematic to generate this for us automatically. It currently still defaults to the `NgModule`\-based approach to application development.

With Standalone Components offering a potentially much-improved developer experience, we felt it made sense to allow Standalone Component-based applications and libraries to be generated from a single command, filling the void in the Angular CLI. So we updated our `@nrwl/angular` plugin to do just that!

This article will walk through how to set up an Nx Workspace with the `@nrwl/angular` plugin preinstalled, and then how to use the generators the plugin offers to scaffold Standalone Component-based applications and libraries from the CLI. It will also cover how to automatically wire routing between the application and lazy-loaded feature libraries.

> Note: I have renamed the concept of “Feature Modules” to “Feature Libraries” as the former term no longer makes sense in a Standalone Component world.

## Initial Setup

First, create a new Nx Workspace by running the following command:

```shell
npx create-nx-workspace@latest myorg --preset=angular --appName=app1 --style=css
```

You’ll be prompted for some additional options, you can answer them how you please.

The command will create a new directory for us named `myorg`. So we'll want to ensure we are working in that directory by running:

```
cd myorg
```

The first command will have done the following:

- Created our Nx Workspace
- Installed the `@nrwl/angular` plugin and its required dependencies
- Created an initial application named `app1`

The application that got created will be following the `NgModule` approach, so we can safely ignore it.

## Generating a Standalone Component-based Application

However, we really want to check out a Standalone Component-based application, so let's go ahead and generate one!

```shell
npx nx g @nrwl/angular:app myapp --standalone --routing
```

This command will generate our application and also configure an initial routing setup for us. You’ll notice immediately that there was no `app.module.ts` file created.

If we look at `apps/myapp/src/app/app.component.ts`, we'll see the following

There are two main things to call out here, so let’s take a look at them.

```
@Component({
    standalone: true,
    ...
})
```

We can see a new boolean `standalone: true` added to the decorator metadata. This tells Angular and its compiler that this Component is a Standalone Component and therefore does not be declared in an `NgModule` to be used.

```
@Component({
    imports: \[NxWelcomeComponent, RouterModule\],
    ...
})
```

An `imports` property is also set in the decorator metadata, and it allows us to import Standalone Components and NgModules that our Component requires to be compiled and function correctly. We can now use directives, services, pipes etc. that would be exported by NgModules in our component, without our component requiring a parent `NgModule`. This provides interoperability between NgModules and Standalone Components which is incredibly useful while we still have `NgModules` around, either from the official Angular packages or from third-party packages.

If we run `npx nx serve myapp` and navigate to `localhost:4200` we can see that the application functions exactly the same as with an `NgModule`\-based app.

I mentioned previously that the `src/main.ts` file also changes to support Standalone Components. It's worth taking a look at it to see the differences, but we generate what is required automatically for you anyway!

## Generating a Standalone Component Feature Library

Angular developers will be familiar with the concept of Feature Modules, however, as we are not using `NgModules` this term doesn't quite make sense. Nx has always had the concept of Workspace Libraries, where an application can be split into domain libraries that are consumed directly by the application and do not need to be published.

By combining both of these concepts, we can create the term "Feature Library" which allows us the same benefits of Feature Modules but with Standalone Components.

In Nx, we can generate a library for our feature, have it create an initial Standalone Component and allow it to be routed to, eagerly or lazily, by the application.

This will make more sense after we generate a library which can be done by running the following command

```shell
npx nx g @nrwl/angular:library mylib --standalone --routing
```

You’ll see that this command creates a Standalone Component named `mylib` as well as a `routes.ts` file. If we take a closer look at `routes.ts`, we'll see that it is just a standard `Route[]` configuration and that it gets exported from `index.ts`.

Angular realised that by making `NgModule` optional, they needed a better method to handle routing that by having to use `RouterModule.forChild()` and their answer was to allow `loadChildren` to point directly to the exported `Route[]` configuration.

We can edit `apps/myapp/src/main.ts` to add a route to our new feature library:

You can see above that we just point directly to the exported const `MYLIB_ROUTES` in our route. By running `npx nx serve myapp` and navigating to `http://localhost:4200/mylib` you can see at the bottom that the Standalone Component has been rendered correctly!

## But we can do more

The `@nrwl/angular:library` generator also offers support for automatically wiring the route to your Feature Library to your application, all from the one command. Let's generate a new library to see this in action.

```shell
npx nx g @nrwl/angular:library dashboard --standalone --routing --lazy --parent=apps/myapp/src/main.ts
```

This command will

- generate our `dashboard` library with a Standalone Component
- configure routing for the library
- attach to the route to `myapp`

If we take a look at `apps/myapp/src/main.ts` again, we can see our new route was added automatically!

## Conclusion

Standalone Components offers a much better DX than `NgModule` based approach to Angular application development and Nx aims to make it as straightforward and as simple as possible to adopt!

## Learn More

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nrwl Youtube Channel](https://www.youtube.com/nrwl_io)
- 🥚 [Free Egghead course](https://egghead.io/courses/scale-react-development-with-nx-4038)
- 🧐 [Need help with Angular, React, Monorepos, Lerna or Nx? Talk to us 😃](https://nrwl.io/contact-us)
