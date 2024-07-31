---
title: 'Build and Deploy the Remote Applications to Netlify'
slug: 'build-and-deploy-the-remote-applications-to-netlify'
authors: ['Colum Ferry']
cover_image: '/blog/images/2022-01-19/0*HQzdmymbKGiCBVgn.png'
tags: [nx, release]
---

This is the third article in a series of articles that aims to showcase the process of scaffolding and deploying a Micro Frontend Architecture using [Nx](https://nx.dev/) and [Netlify](https://netlify.com/). We are going to develop and independently deploy two applications to Netlify.

The two applications consist of a ToDo app, which will be non-functional and whose sole purpose is to be a placeholder to protect behind an authorization guard, and a Login app, which will provide a basic login form along with a shared auth lib containing a stateful service for managing the authed user.

## Articles in the Series

- [Introduction to Deploying MFEs with Netlify](https://medium.com/introduction-to-deploying-angular-mfes-with-netlify-d6a6f6b70a26)
- [Scaffold and Deploy the Dashboard to Netlify](https://medium.com/scaffold-and-deploy-the-dashboard-to-netlify-47e7c36f7823)
- **Build and Deploy the Remote Applications to Netlify**
- [Integrate the Remote apps with the Dashboard](https://medium.com/integrate-the-remote-apps-with-the-dashboard-ce8efc61ebce?sk=e82e0ebf5895feaab6ef8866ea9fd88b)

or [subscribe to the newsletter](https://go.nrwl.io/nx-newsletter) to get notified when new articles get published.

## Build ToDo App

### Generate the app

Starting with the ToDo app, run the following command to generate the app with a Micro Frontend configuration.

```shell
yarn nx g @nrwl/angular:remote todo --host=dashboard
```
