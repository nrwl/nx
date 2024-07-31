---
title: 'Scaffold and Deploy the Dashboard to Netlify'
slug: 'scaffold-and-deploy-the-dashboard-to-netlify'
authors: ['Colum Ferry']
cover_image: '/blog/images/2022-01-12/1*pOWiZcC6kbhpD2tBw2qD7A.png'
tags: [nx, release]
---

This is the second article in a series of articles that aims to showcase the process of scaffolding and deploying a Micro Frontend Architecture using [Nx](https://nx.dev/) and [Netlify](https://netlify.com/). We will generate the Dashboard application as a host app and walk through the steps of deploying it to Netlify.

### Articles in the Series

- [Introduction to Deploying MFEs with Netlify](https://medium.com/introduction-to-deploying-angular-mfes-with-netlify-d6a6f6b70a26)
- **Scaffold and Deploy the Dashboard to Netlify**
- [Build and Deploy the Remote Applications to Netlify](https://medium.com/build-and-deploy-the-remote-applications-to-netlify-430ee350573a)
- [Integrate the Remote apps with the Dashboard](https://medium.com/integrate-the-remote-apps-with-the-dashboard-ce8efc61ebce?sk=e82e0ebf5895feaab6ef8866ea9fd88b)

or [subscribe to the newsletter](https://go.nrwl.io/nx-newsletter) to get notified when new articles get published.

## Scaffold the Dashboard

![](/blog/images/2022-01-12/1*PLxs3qD2w1oLNI7HS_MU2g.avif)

The Dashboard application will be a host MFE app. In the context of Micro Frontends, a host application fetches federated code from a series of remotely deployed applications at runtime. It acts as a container for the remotely deployed applications, hosting them in a specific area within the host app that makes sense for your system. It makes a request to the deployed remote applications to fetch…
