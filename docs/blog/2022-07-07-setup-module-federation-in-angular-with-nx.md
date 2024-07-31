---
title: 'Setup Module Federation in Angular with Nx'
slug: 'setup-module-federation-in-angular-with-nx'
authors: ['Colum Ferry']
cover_image: '/blog/images/2022-07-07/1*FQ6VwB32j8-8ZiaHQ_ryHA.png'
tags: [nx, release]
---

As our [Angular](https://angular.io/) applications grow, building the application takes longer and longer. This means we sometimes spend more time waiting on the application to build than actually writing code. This becomes even more frustrating when we take into consideration that we usually only need to focus on one specific part of the full monolithic application.

At this point, we usually look to split the monolithic application into smaller subsections.

The idea of Micro Frontends lends itself well to achieving this, but we do not need to use Micro Frontends to achieve it. Instead, the technology behind modern Micro Frontend solutions is where the real power is at.

> You can learn more about this concept [here](https://www.youtube.com/watch?v=cq08bFUrNAA&t=2606s).

[Webpack 5](https://webpack.js.org/) introduced the [Module Federation Plugin](https://webpack.js.org/concepts/module-federation/) which has rapidly become the go-to solution for splitting large monolithic applications into smaller composable pieces.

In this article, we’ll walk through how [Nx](https://nx.dev/) makes it extremely straightforward to set up Module Federation for an Angular application, both from scratch and also for converting an existing Angular application into multiple composable slices.

**Prefer a video walk-through?**
