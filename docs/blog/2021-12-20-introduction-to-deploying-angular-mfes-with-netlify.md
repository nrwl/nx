---
title: 'Introduction to Deploying Angular Micro Frontends with Netlify'
slug: 'introduction-to-deploying-angular-mfes-with-netlify'
authors: ['Colum Ferry']
cover_image: '/blog/images/2021-12-20/1*pOWiZcC6kbhpD2tBw2qD7A.png'
tags: [nx, release]
---

This series of articles will aim to showcase the process of scaffolding and deploying a Micro Frontend Architecture using [Nx](https://nx.dev/) and [Netlify](https://netlify.com/).

### Articles in this series

- **Introduction to Deploying MFEs with Netlify**
- [Scaffold and Deploy the Dashboard to Netlify](https://medium.com/scaffold-and-deploy-the-dashboard-to-netlify-47e7c36f7823)
- [Build and Deploy the Remote Applications to Netlify](https://medium.com/build-and-deploy-the-remote-applications-to-netlify-430ee350573a)
- [Integrate the Remote apps with the Dashboard](https://medium.com/integrate-the-remote-apps-with-the-dashboard-ce8efc61ebce?sk=e82e0ebf5895feaab6ef8866ea9fd88b)

## What we’ll build

Here is a short video introducing this series of articles and showcasing what we’ll build.

It’s a pretty straightforward system consisting of three independently deployed applications, with one composing the other two into a complete system, taking full advantage of [Module Federation](https://webpack.js.org/concepts/module-federation/) to do so.

**We’ll build:**

- A login application
- A “todo” application (it won’t function, just serve as a placeholder)
- A dashboard…
