---
title: 'Setting up Module Federation with Server-Side Rendering for Angular'
slug: 'setting-up-module-federation-with-server-side-rendering-for-angular'
authors: ['Colum Ferry']
cover_image: '/blog/images/2023-01-10/1*kyMChnJ-X6jK9sbuaOdOiw.png'
tags: [nx, tutorial]
---

[Module Federation](https://webpack.js.org/plugins/module-federation-plugin/) is a technology provided by [Webpack](https://webpack.js.org/) that enables modules to be federated across different origins at runtime. This means that Webpack will simply ignore these modules at build time, expecting them to be available to be fetched across the network at runtime.

This technology has enabled a much cleaner approach to Micro Frontend Architecture but also is employable as a strategy to implement incremental builds for large applications, reducing overall build times. This can lead to faster feedback cycles and less money spent on CI workflows.

Nx offers great out-of-the-box support and developer experience for Module Federation for Angular and React. You can learn more about it from the resources below:

📄 [Module Federation Recipes on Nx](/recipes/module-federation)  
📺 [Speed up your Angular serve and build times with Module Federation and Nx](https://www.youtube.com/watch?v=JkcaGzhRjkc)

However, until now, it has only supported Client-Side Rendering (CSR). Essentially it worked only for Single Page Applications (SPAs). While this is still valuable, it is becoming ever more apparent that Server-Side Rendering (SSR) is becoming the de-facto standard for building web applications, due to the multitude of benefits it provides.

> [What is server-side rendering: definition, benefits and risks](https://solutionshub.epam.com/blog/post/what-is-server-side-rendering)

Since [version 15.4](blog/nx-15-4-vite-4-support-a-new-nx-watch-command-and-more), Nx now offers Module Federation with support for SSR! 🎉

Now we can get both, the benefits of Module Federation and SSR in our Nx Workspaces!

## How it works

A traditional SSR application is rendered on the server. It receives the requested route from the browser, Angular evaluates that route, and the server generates the HTML and sends it back to the browser.

![](/blog/images/2023-01-10/0*ZqG4jdD8DaqmG_It.avif)

With Module Federation and SSR, it takes that concept and the concept of MF to allow portions of the app to be run on their own server. The host server will receive the route and if it’s a route pointing to a remote, it will ask the remote to process the route, then send the rendered HTML to the browser.

![](/blog/images/2023-01-10/0*eQis_bQnsj-MToCa.avif)

This gives us full power of SSR but also still allowing us to break our build into multiple smaller builds. It also means that we _could_ redeploy the remote server with new changes without having to redeploy the host server, allowing for independent deployability of features within the overall application.

## Example

Let’s walk through how to set this up with Nx for Angular. We will generate a host application (dashboard) and a remote application (login).

```shell
npx create-nx-workspace@latest myorg
```

You’ll be prompted for the type of workspace you want to create, and the preset to use.

Answer with the following:

✔ Choose what to create · integrated  
✔ What to create in the new workspace · apps  
✔ Enable distributed caching to make your CI faster · No

> _You will also be prompted whether to add Nx Cloud to your workspace. We won’t address this in this article, but it is highly recommended to use this along with Module Federation to allow for the cache of your remote applications to be shared amongst teammates and CI, further improving your build times. You can learn more about Nx Cloud here:_ [_https://nx.app_](https://nx.app/)_._

When your workspace is created, run `cd myorg`.

Next, we will need to install the [Official Nx Angular Plugin](/nx-api/angular):

```
npm install @nrwl/angular
```

Once this is installed, we only need one command to scaffold out our full Module Federation with SSR architecture:

```shell
npx nx g host dashboard --remotes=login --ssr
```

We will see in the terminal that this generates a bunch of files. What it actually creates is:  
Two applications with Angular Universal (SSR)  
Webpack Configuration for Browser and Server with Module Federation

We can serve our dashboard (host) application, along with our login (remote) application, by simply running the command:

```shell
npx nx serve-ssr dashboard
```

This will build the browser and server bundles of our login application, then run the login using node.  
The login application will be run without any file watchers, meaning that if you make a change to the code for the login application, it will not be reflected automatically. More on this later.

> Note: Nx will cache the build of the browser and server bundles for the login application. If you were to run the command again, it would simply use the cache rather than actually rebuilding the application! 🔥.

Once this is complete, it will then build and run the server for the dashboard application, _with_ file watchers, allowing it to pick up changes to the code.

You should see a success message like this in the terminal:

```
Compiled successfully.
\*\* Angular Universal Live Development Server is listening on http://localhost:4200, open your browser on http://localhost:4200 \*\*
```

Let’s open a new tab in our browser, and open Network tab in the DevTools. After this, navigate to [http://localhost:4200](http://localhost:4200/). You should see the following:

![](/blog/images/2023-01-10/0*3irxzNENB79JiQmR.avif)

The most interesting piece here is the first entry in the network log. Let’s look at it more closely:

![](/blog/images/2023-01-10/0*Ikvgk8dF8rKmutTY.avif)

We can see that the server returned the fully rendered HTML for the page!

Angular Universal will switch to CSR after the initial page load, which means if we were to click on the `login` link, it would use CSR to render that page. The Angular Module that is resolved and rendered still lives on the remote server, but Module Federation will still resolve this correctly! 🔥

But to see where the real magic happens, let’s manually navigate the browser to [http://localhost:4200/login](http://localhost:4200/login). You should see that in the Network tab, the fully rendered HTML for the login page has been returned!

Despite the code for that page living on a different, remote, server, the host server composed it correctly and was still able to return the correct HTML for that route, thanks to Module Federation!

And that’s it! It’s super simple to get Module Federation and SSR up and running with Nx!

## Serving the login application and watching for changes

If you’re working on the login application, and are iteratively checking the results of your changes, you’ll want the server to rebuild when you make your change. You can easily enable that by using the `devRemotes` flag::

```shell
npx nx serve-ssr dashboard --devRemotes=login
```

## Learn More

🧠 [Nx Docs](/getting-started/intro)  
👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)  
💬 [Nx Official Discord Server](https://go.nx.dev/community)
📹 [Nrwl Youtube Channel](https://www.youtube.com/@nxdevtools)  
🥚 [Free Egghead course](https://egghead.io/courses/scale-react-development-with-nx-4038)  
🧐 [Need help with Angular, React, Monorepos, Lerna or Nx? Talk to us 😃](https://nx.app/enterprise)
