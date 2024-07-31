---
title: 'Setup Module Federation in Angular with Nx'
slug: 'setup-module-federation-in-angular-with-nx'
authors: ['Colum Ferry']
cover_image: '/blog/images/2022-07-07/1*FQ6VwB32j8-8ZiaHQ_ryHA.png'
tags: [nx, tutorial]
---

As our [Angular](https://angular.io/) applications grow, building the application takes longer and longer. This means we sometimes spend more time waiting on the application to build than actually writing code. This becomes even more frustrating when we take into consideration that we usually only need to focus on one specific part of the full monolithic application.

At this point, we usually look to split the monolithic application into smaller subsections.

The idea of Micro Frontends lends itself well to achieving this, but we do not need to use Micro Frontends to achieve it. Instead, the technology behind modern Micro Frontend solutions is where the real power is at.

> You can learn more about this concept [here](https://www.youtube.com/watch?v=cq08bFUrNAA&t=2606s).

[Webpack 5](https://webpack.js.org/) introduced the [Module Federation Plugin](https://webpack.js.org/concepts/module-federation/) which has rapidly become the go-to solution for splitting large monolithic applications into smaller composable pieces.

In this article, we’ll walk through how Nx makes it extremely straightforward to set up Module Federation for an Angular application, both from scratch and also for converting an existing Angular application into multiple composable slices.

**Prefer a video walk-through?**

{% youtube src="https://www.youtube.com/watch?v=JkcaGzhRjkc" /%}

## Convert an existing monolithic application

Let’s say we have a single Angular application in an Nx Workspace with the following architecture:

![](/blog/images/2022-07-07/0*QXn2JhBwUtTDFG17.avif)

> If you are not already using Nx, and want to take advantage of this, consider migrating to Nx first. You can find out more about that [here](/recipes/angular/migration/angular)

We can see that, despite being a single application, there are already some clearly defined domains (or slices) within our application. This model of definable domains matches most typical application designs.

However, developers in your organization are complaining that they are waiting an ever-increasing length of time for their builds and serves to complete. They’re also frustrated because they only need to target one area of the overall application and don’t care necessarily about the domains they aren’t interested in.

The agreed solution is that every domain in the application will become its own application owned by a feature team, and they’ll all be composed in the host application. This results in an architecture like this:

![](/blog/images/2022-07-07/0*r0V_z6z-y6ZToIbY.avif)

To achieve this in an Nx Workspace, it is as simple as running the following command:

```shell
npx nx g @nrwl/angular:setup-mf ourapp --mfType=host
```

This will set up Webpack’s Module Federation Plugin for the application and configure it as a host application, ready to consume remote applications.

The command above did the following:

1.  Adds a `module-federation.config.js` file containing the necessary configuration for Module Federation
2.  Adds a `webpack.config.js` and `webpack.prod.config.js` which uses the config from `module-federation.config.js` and the `withModuleFederation` to configure the underlying webpack config to use Module Federation.
3.  Changes the `build` and `serve` target to use `@nrwl/angular:webpack-browser` and `@nrwl/angular:module-federation-dev-server` respectively, which allow for custom webpack configs to be passed to the underlying Angular builder

Now, we’ll want to create remote applications for each domain. Nx has a generator to help us do it, and it even lets us tell it the name of the host application so that it can do some automatic wiring and routing configuration.

```shell
npx nx g @nrwl/angular:remote featureA --host=ourapp
npx nx g @nrwl/angular:remote featureB --host=ourapp
npx nx g @nrwl/angular:remote featureC --host=ourapp
```

For each of the domains, this generator did the following:

1.  Creates a new Angular application in the workspace specific for the feature.
2.  Adds a `module-federation.config.js` file containing the necessary configuration for Module Federation.
3.  Adds a `webpack.config.js` and `webpack.prod.config.js` which uses the config from `module-federation.config.js` and the `withModuleFederation` to configure the underlying webpack config to use Module Federation.
4.  Changes the `build` and `serve` target to use `@nrwl/angular:webpack-browser` and `@nrwl/angular:webpack-server` respectively, which allow for custom webpack configs to be passed to the underlying Angular builder.
5.  Adds a new `serve-static` target which uses `@nrwl/angular:file-server` executor to serve the previously built files as though on a web-server.
6.  Updates the Host application’s `module-federation.config.js` to point to the remote application.
7.  Updates the Host application’s `app.module.ts` to set up a `Route` for the remote application.

Within each of our remote applications, we’ll want to wire up the `RemoteEntryModule` to use the feature modules that had existed in the monolith. At this time, we'll also want to remove them from `ourapp`. This means that `ourapp` no longer needs to build them!

As you have probably deduced already, instead of one application that needs to build everything, we now have four applications that only need to build the code that they are interested in.

However, serving our new architecture is exactly the same! We just need to run

```shell
npx nx serve ourapp
```

This does behave slightly differently from our usual Angular serve. That is because by default when we try to serve our host, Nx will only serve the static files for each of the remote applications (unless told to do otherwise, more on that later).

So, let’s say we’re actively working on `featureB`, then we would simply run:

```shell
npx nx serve ourapp --devRemotes=featureB
```

This will use `webpack-dev-server` to serve the host application (`ourapp`) and the remote application (`featureB`). This will be all set up with live reloading etc. The other remote applications (`featureA`, `featureC`) will still be served, but just as static files!

This introduces an incredible benefit to our developer experience. Now, instead of having webpack build and serve everything in the application, we only build and serve what we actually want, which is usually only one domain (or slice) of the application. Yet, we maintain the usual experience of navigating through our application _as though_ **everything** was served!

There’s no additional overhead of rebuilding them because they will be fetched from cache! And, if you have Nx Cloud turned on, you may _never_ have to build domains you are not working in, because someone else in your team, or the CI machine itself, will have already built those remote applications, and you’ll get to take advantage of the distributed cache!!

You can now continue developing as normal, but everything will just be a lot faster, and you’ll have Module Federation set up in your Workspace, which puts you in a good position to then take it further and truly go down the Micro Frontend route if that is your desire.

## Setting up new workspaces for Module Federation

If you do not have an existing application that you’re splitting out into multiple slices, but rather you have a new application and you wish to take advantage of the Module Federation architecture, Nx can help you quickly scaffold out the host application as well as all the remotes you need with one command:

```shell
npx nx g @nrwl/angular:host shell --remotes=featureA,featureB,featureC
```

Running this command will do the following:

1.  Create the host application named Shell
2.  Create three remote applications for each feature listed
3.  Wire up the remote applications to the host application

Now you can run `nx serve shell` and it'll build and serve the full architecture!

## Conclusion

As you can see, Nx makes it super straightforward to set up Module Federation for new and existing applications!!

We would love for you to try it out and let us know what you think!

Also, make sure you don’t miss anything by

- Following us [on Twitter](https://twitter.com/NxDevTools), and
- Subscribe to the [YouTube Channel](https://youtube.com/nrwl_io?sub_confirmation=1) for more information on [Angular](https://angular.io/), [React](https://reactjs.org/), Nx, and more!
- Subscribing to [our newsletter](https://go.nrwl.io/nx-newsletter)!

As always, if you are looking for enterprise consulting, training and support, you can find out more about how we work with our clients [here](https://nrwl.io/services).
