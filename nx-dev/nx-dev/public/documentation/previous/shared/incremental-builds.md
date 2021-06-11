# Incremental Builds

As your applications are getting bigger, one of the main ways to scale your development is to build them in an incremental fashion.
Right now, for instance, say we generate an application and a library as follows:

```bash
nx g @nrwl/react:app myapp
nx g @nrwl/react:lib mylib
```

...and then import the library from the application. In this case, `mylib` isn't a buildable library. We cannot test and lint it independently, but the only way to build it is by building some application using it (in this case `myapp`). The default setup is to use Webpack, which builds "mylib" and bundles it directly into "myapp".
This provides the best dev experience for small and medium-size applications, because Webpack is optimized for this scenario. But as your application keeps growing, the dev experience degrades.

> The **duration** of the invoked operations should be **proportional** to the **size of the change**

## Publishable and Buildable Libraries

Nx has **publishable libraries**. As the name suggests, such libraries are meant to be built and published to some package registry s.t. they can be consumed also from outside the Nx workspace. The executor for building a publishable library does more than just building. It makes sure the output is properly compressed and might even produce more bundles s.t. the package can be consumed in a variety of ways (e.g. also produces UMD bundles).

```
nx g @nrwl/react:lib mylib --publishable --importPath=@myorg/mylib
```

On the other hand, the executor of a **buildable library**, performs a subset of the operations compared to the publishable library's executor. That's because buildable libraries are not intended to be published and thus only produce the minimum necessary output for the incremental build scenario to work. For example, no UMD bundles or minification is being done. The main goal of the executor is to perform the build as fast as possible.

```
nx g @nrwl/react:lib mylib --buildable
```

Read more about [Publishable and Buildable Nx Libraries here.](/{{framework}}/structure/buildable-and-publishable-libraries)

## Nx computation cache and Nx Cloud

In an incremental build scenario, when building the app, all it's dependencies need to be built first. In our scenario above, that means we need to first run `nx build mylib` and then `nx build myapp`. As the number of libraries grows, running these commands quickly becomes unmanageable. Instead, we can run `nx build myapp --with-deps`.

It is costly to rebuild all the buildable libraries from scratch every time you want to serve the app. That's why the Nx computation caching is so important. The caching allows us to only rebuild a small subset of the libraries, which results in much better performance.

If we can share the cache with our teammates, we can get a much better dev experience. For instance, [this repo](https://github.com/nrwl/nx-incremental-large-repo) has a large application, where `nx serve` takes just a few seconds.

![comparison: webpack vs incremental build](/shared/incremental-build-webpack-vs-incremental.png)

The above chart has three different test runs:

- **Normal build -** which visualizes using the normal Angular webpack setup executing “nx build” (blue), “nx serve” (red) and the time to rebuild/re-serve when a file change happened (yellow)

- **Incremental build (cold) -** running all the above commands but using the Nx incremental builds but without having any kind of cache. That run takes slightly more than the normal Webpack build, which is expected.

- **Incremental build (warm) -** running the Nx incremental build having already cached results from a previous run or from some other coworker that executed the build before. In a real world scenario, we expect always some kind of cached results either of the entire workspace or part of it. This is where the teams really get the value and speed improvements.

## When should I use incremental builds

We're continuously improving the speed of incremental builds. However as of now, incremental builds become really beneficial in **really large repositories**.

Also, using incremental builds only really makes sense when using the distributed Nx caching with Nx Cloud. Check out [nx.app](https://nx.app) for more information on how to setup distributed caching.

## Setup an incremental build

- [Setup an incremental build for an Angular app](/latest/angular/ci/setup-incremental-builds-angular)
- _Setup an incremental build for a React app (soon)_
- _Setup an incremental build for a Node app (soon)_
