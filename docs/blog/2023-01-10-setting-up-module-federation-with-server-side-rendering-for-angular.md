---
title: 'Setting up Module Federation with Server-Side Rendering for Angular'
slug: 'setting-up-module-federation-with-server-side-rendering-for-angular'
authors: ['Colum Ferry']
cover_image: '/blog/images/2023-01-10/1*kyMChnJ-X6jK9sbuaOdOiw.png'
tags: [nx, release]
---

[Module Federation](https://webpack.js.org/plugins/module-federation-plugin/) is a technology provided by [Webpack](https://webpack.js.org/) that enables modules to be federated across different origins at runtime. This means that Webpack will simply ignore these modules at build time, expecting them to be available to be fetched across the network at runtime.

This technology has enabled a much cleaner approach to Micro Frontend Architecture but also is employable as a strategy to implement incremental builds for large applications, reducing overall build times. This can lead to faster feedback cycles and less money spent on CI workflows.

[Nx](https://nx.dev/) offers great out-of-the-box support and developer experience for Module Federation for Angular and React. You can learn more about it from the resources below:

📄 [Module Federation Recipes on Nx](https://nx.dev/recipes/module-federation)  
📺 [Speed up your Angular serve and build times with Module Federation and Nx](https://www.youtube.com/watch?v=JkcaGzhRjkc)

However, until now, it has only supported Client-Side Rendering (CSR). Essentially it worked only for Single Page Applications (SPAs). While this is still valuable, it is becoming ever more apparent that Server-Side Rendering (SSR) is becoming the de-facto standard for building web applications, due to the multitude of benefits it provides.

> [What is server-side rendering: definition](https://solutionshub.epam.com/blog/post/what-is-server-side-rendering)…
