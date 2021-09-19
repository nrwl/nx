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

```bash
nx g @nrwl/react:lib mylib --publishable --importPath=@myorg/mylib
```

On the other hand, the executor of a **buildable library**, performs a subset of the operations compared to the publishable library's executor. That's because buildable libraries are not intended to be published and thus only produce the minimum necessary output for the incremental build scenario to work. For example, no UMD bundles or minification is being done. The main goal of the executor is to perform the build as fast as possible.

```bash
nx g @nrwl/react:lib mylib --buildable
```

Read more about [Publishable and Buildable Nx Libraries here.](/{{framework}}/structure/buildable-and-publishable-libraries)

## Nx computation cache and Nx Cloud

In an incremental build scenario, when building the app, all it's dependencies need to be built first. In our scenario above, that means we need to first run `nx build mylib` and then `nx build myapp`. As the number of libraries grows, running these commands quickly becomes unmanageable. Instead, we can run `nx build myapp`.

It is costly to rebuild all the buildable libraries from scratch every time you want to serve the app. That's why the Nx computation caching is so important. The caching allows us to only rebuild a small subset of the libraries, which results in much better performance.

If we can share the cache with our teammates, we can get a much better dev experience. For instance, [this repo](https://github.com/nrwl/nx-incremental-large-repo) has a large application, where `nx serve` takes just a few seconds.

![comparison: webpack vs incremental build](/shared/incremental-build-webpack-vs-incremental.png)

The above chart has three different test runs:

- **Normal build -** which visualizes using the normal Angular webpack setup executing “nx build” (blue), “nx serve” (red) and the time to rebuild/re-serve when a file change happened (yellow)

- **Incremental build (cold) -** running all the above commands but using the Nx incremental builds but without having any kind of cache. That run takes slightly more than the normal Webpack build, which is expected.

- **Incremental build (warm) -** running the Nx incremental build having already cached results from a previous run or from some other coworker that executed the build before. In a real world scenario, we expect always some kind of cached results either of the entire workspace or part of it. This is where the teams really get the value and speed improvements.

## When should I use incremental builds

Whether incremental builds area a good choice depends on your repository. For most small and mid-sized applications, the costs introduced by incremental builds will outweigh the benefits.

The upsides of incremental builds:

- Compiling only a subset of code
- Distributing the compilation

The downsides of incremental builds:

- Complex "watch" mode
- Overhead with initializing the TypeScript compiler multiple times
- The linking part of a WebPack build is indivisible

If you are only planning to use incremental builds to speed up your CI, then the watch mode concern is irrelevant, and the only thing you need to assess is whether the benefits of skipping the compilation outweigh the costs of initializing the TypeScript compiler several times.

> For a given workspace you can use Nx batch mode executors to compile all the libs using a single TS program. It can be made to work for a single workspace, but it's hard to generalize. With this, there is only one TS program created, so there is no extra cost associated with incremental builds.

## Custom Serve Target

If you are implementing a custom serve command, you can use `WebpackNxBuildCoordinationPlugin` provided by `@nrwl/web`. It's a webpack plugin you can use to coordinate the compiling of the libs and the webpack linking.

## Using Webpack Module Federation to implement incremental builds

When we talk about incremental builds we often talk about incrementally compiling the code and then linking them with a single webpack build. In this case the build artifact when using incremental builds is the same as without using incremental builds, but the build process itself has different characteristics.

But there are other ways to make the build process incremental. One of them is using WebPack Module Federation.

When using WebPack Module Federation, you split the application into multiple webpack builds. Imagine the application has 3 big sections, and they are built using 3 webpack builds: `W1`, `W2`, and `W3`. Each of them has to build shared code in addition to building the corresponding application section code. So the time it takes to build all of them (`W1` + `W2` + `W3`) will be greater than `W`. However, if you change only Section 1, you will only need to run `W1`. `W2` and `W3` will be retrieved from cache. In addition, `W1`, `W2`, and `W3` can run on separate machines. Because of that, both the CI time and the local serve time can be drastically reduced.
