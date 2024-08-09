---
title: 'Integrate the Remote apps with the Dashboard'
slug: 'integrate-the-remote-apps-with-the-dashboard'
authors: ['Colum Ferry']
cover_image: '/blog/images/2022-01-26/0*A5_NtQzXqV9NHmz7.png'
tags: [nx, release]
---

This is the fourth and final article in a series of articles that aims to showcase the process of scaffolding and deploying a Micro Frontend Architecture using [Nx](https://nx.dev/) and [Netlify](https://netlify.com/). We will build and deploy the remote applications. We’ll build a login app and a todo app and deploy each independently to Netlify.

You can view the code for this part here: [https://github.com/Coly010/nx-mfe-netlify-series/tree/blog-part-four](https://github.com/Coly010/nx-mfe-netlify-series/tree/blog-part-four)

### Articles in the Series

- [Introduction to Deploying MFEs with Netlify](https://medium.com/introduction-to-deploying-angular-mfes-with-netlify-d6a6f6b70a26)
- [Scaffold and Deploy the Dashboard to Netlify](https://medium.com/scaffold-and-deploy-the-dashboard-to-netlify-47e7c36f7823)
- [Build and Deploy the Remote Applications to Netlify](https://medium.com/build-and-deploy-the-remote-applications-to-netlify-430ee350573a)
- **Integrate the Remote apps with the Dashboard**

or [subscribe to the newsletter](https://go.nrwl.io/nx-newsletter) to get notified when new articles get published.

## Overview

In the previous articles, we scaffolded and deployed the Dashboard application, our host application, and built and deployed our Todo application and Login application, our remote applications.

The final step in our solution is to integrate the remote applications into the host application. When our host application loads, it’ll fetch code from the Todo application and the Login application via…
