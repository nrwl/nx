---
title: 'New Terminal Output & Performance Improvements in Nx 13.5'
slug: 'new-terminal-output-performance-improvements-in-nx-13-5'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-01-25/1*PIUl1QGk7mOpSFdEwFQ8OA.png'
tags: [nx]
---

Nx is a smart, extensible build framework to help you architect, test, and build at any scale — integrating seamlessly with modern technologies and libraries while providing a robust CLI, computation caching, dependency management, and more.

### New Terminal Output 💅

Folks that have been following along in our journey for quite some time know already that at Nx we strive for the best possible DX. The current terminal output was always something we haven’t been super happy with, especially if you run some of the commands that trigger the execution of multiple tasks (e.g. affected commands, run-many etc). This is why we’re even more excited about this feature: the new dynamic Nx terminal output is now the default for everyone.

![](/blog/images/2022-01-25/1*81krRElSXV5w2T54DiCBAA.avif)
_New dynamic terminal output in Nx 13.5_

It clearly separates the terminal output into an upper part where all the completed tasks and their corresponding execution time are listed and a lower part where the currently running tasks show up. Of course, errors are always shown immediately and therefore easy to spot.

There are a few things to note here (and which kinda emphasize our love with details & dev ergonomics 😉)

- **Off in CI —** On CI you’ll still see the full output.
- **The full terminal output is still cached —** this is purely UI cosmetic. We still cache the entire terminal output. Hence, if you run the build of a single project that has previously been cached as part of a run-many command, you will see still the full output.

Thanks to [James Henry](https://twitter.com/mrjameshenry) for working on this feature!

### Nx keeps getting faster and faster 🚀

Performance is a feature, and we take it seriously with Nx. We landed a number of different performance improvements over the last couple of minor versions, ranging from optimizing how we store & restore our cache to improving the Nx workspace analysis and boot time. With v13.5 we’ve seen some Nx operations being

- 1.8x — 2.3x faster in the [Interstellar repo](https://github.com/vsavkin/interstellar)
- about 2x faster on some large client repositories

And we will not rest 😉.

### Performance Profiling with Nx 🧐

When running an Nx command there might potentially be many tasks running at different times, in parallel, and using different processes. Optimizing those runs or better understanding where things go wrong might be a hard and cumbersome process. Being able to visualize things usually helps.

That’s why we introduced the ability to profile and visualize Nx commands in the Chrome Devtools.

![](/blog/images/2022-01-25/1*7vk8AUWRGkDI0vcVX4Ql-g.avif)

Use the `NX_PROFILE=<filename>` environment variable attached to your Nx CLI command:

```shell
NX_PROFILE=profile.json nx build cart
```

It’ll produce a JSON file which you can then open with Chrome’s devtools. [Read more about it on the Nx Docs](/troubleshooting/performance-profiling).

Thanks [Jason](https://twitter.com/FrozenPandaz) for working on this feature!

### React Native now supports Environment Variables

Whenever you set up React Native support within an Nx workspace, it should now automatically come with the [react-native-config](https://github.com/luggit/react-native-config) package installed. That allows you to have a `.env` file in the React Native app folder which can then be loaded from within your React Native application.  
You can find all the details on the [Nx docs](/recipes/react/react-native).

Thanks [Emily Xiong](https://twitter.com/xiongemily) for implementing this!

### Improvements to the Project Graph Visualization

The project graph is always a nice feature to show off in videos, talks, and blog posts. But if done naively, it just remains that. We always wanted it to be more than that. As your workspace grows, your project graph visualization should become more useful, rather than a mess to look at. This is why we kept adding features for filtering, zooming, highlighting, focusing on specific nodes, incrementally expanding the view by using the proximity feature and more.

In v13.5 we now also store the current filter status in the URL. That makes it easy to pinpoint a certain view and share it with a co-worker. Actually, this could just be the beginning of some more interesting features when we think about CI and visualizations 🤔.

![](/blog/images/2022-01-25/1*RM9hDFIsgLn1X4EX5qsgGg.avif)
_Nx dep graph now stores filters in the URL_

Here’s our deployed live example of the above screenshot: [https://nrwl-nx-examples-dep-graph.netlify.app/?focus=products-home-page](https://nrwl-nx-examples-dep-graph.netlify.app/?focus=products-home-page)

Thanks [Philip Fulcher](https://twitter.com/PhilipJFulcher) for adding this feature!

There’s one more thing: As developers, we like to be as efficient as possible. We wanted to help by saving you some keystrokes. The project graph visualization can now be launched with

```shell
nx graph
```

`nx dep-graph` is registered as an alias and will continue to work 🙂.

### New improvements to our Angular plugin

There have been a number of improvements to our Angular plugin ( `@nrwl/angular` ) :

- Option to skip the Angular Module creation when generating new libraries by passing `--skipModule`
- Support for multiple state slices when using the Nx Angular Data Persistence utilities. Thanks [David](https://medium.com/u/6e7f9350fcdf?source=post_page-----c407bb1c963a--------------------------------) for this community contribution !([#8216](https://github.com/nrwl/nx/pull/8216))
- New Angular Nx workspaces now use v2 of the workspace configuration (Nx’s format of the `angular.json` )
- Lots of improvements to the Angular SCAM generator

## How to Update Nx

Updating Nx is done with the following command, and will update your Nx workspace dependencies and code to the latest version:

```shell
nx migrate latest
```

After updating your dependencies, run any necessary migrations.

```shell
nx migrate --run-migrations
```

## Explore More

- Get our [free basic Nx workspaces course on YouTube](https://youtu.be/2mYLe9Kp9VM)!
- Purchase our premium video course on advanced practices for Nx workspaces: [here](https://nxplaybook.com/p/advanced-nx-workspaces)!

Follow us [on Twitter](https://twitter.com/NxDevTools), and subscribe to the [YouTube Channel](https://youtube.com/nrwl_io?sub_confirmation=1) for more information on [Angular](https://angular.io/), [React](https://reactjs.org/), Nx, and more!
