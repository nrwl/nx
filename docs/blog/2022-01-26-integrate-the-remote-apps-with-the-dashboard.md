---
title: 'Integrate the Remote apps with the Dashboard'
slug: 'integrate-the-remote-apps-with-the-dashboard'
authors: ['Colum Ferry']
cover_image: '/blog/images/2022-01-26/0*A5_NtQzXqV9NHmz7.png'
tags: [nx, tutorial]
---

This is the fourth and final article in a series of articles that aims to showcase the process of scaffolding and deploying a Micro Frontend Architecture using Nx and [Netlify](https://netlify.com/). We will build and deploy the remote applications. We’ll build a login app and a todo app and deploy each independently to Netlify.

You can view the code for this part here: [https://github.com/Coly010/nx-mfe-netlify-series/tree/blog-part-four](https://github.com/Coly010/nx-mfe-netlify-series/tree/blog-part-four)

### Articles in the Series

- [Introduction to Deploying MFEs with Netlify](/blog/introduction-to-deploying-angular-mfes-with-netlify)
- [Scaffold and Deploy the Dashboard to Netlify](/blog/scaffold-and-deploy-the-dashboard-to-netlify)
- [Build and Deploy the Remote Applications to Netlify](/blog/build-and-deploy-the-remote-applications-to-netlify)
- **Integrate the Remote apps with the Dashboard**

or [subscribe to the newsletter](https://go.nrwl.io/nx-newsletter) to get notified when new articles get published.

## Overview

In the previous articles, we scaffolded and deployed the Dashboard application, our host application, and built and deployed our Todo application and Login application, our remote applications.

The final step in our solution is to integrate the remote applications into the host application. When our host application loads, it’ll fetch code from the Todo application and the Login application via network requests, and load and use them correctly to compose a single system.

## Integrate the Remote Applications

We’ll be using static Module Federation in this example to compose the Micro Frontends, however, it’s important to understand the limitations of this and why Dynamic Module Federation may be a better solution. You can read more about that here: [https://www.angulararchitects.io/en/aktuelles/dynamic-module-federation-with-angular/](https://www.angulararchitects.io/en/aktuelles/dynamic-module-federation-with-angular/)

### Set up Routing

We will use routing to route between our federated code. The Nx generator for scaffolding our remote applications has already done the heavy lifting. We can see this if we open `apps/dashboard/src/app/app.module.ts` which should contain the following routing configuration:

The generated configuration has already routes set up to load the federated code with paths to each module. Let’s change it so that we redirect to the `/todo` route if the user has logged in:

1.  Change the routes to be child routes
2.  Adding a redirect route
3.  Adding our `AuthGuard` as a `CanActivate` guard to `/todo`

The end result should look like the following:

We need to make sure that our `app.component.html` has the necessary `<router-outlet>`and then we can serve our MFE architecture and test it out!

Host applications in an Nx based MFE setup have a dedicated target defined that let us serve the remote applications and the host application at once. This allows for quicker testing of our integration.

Just run

```shell
npx nx run dashboard:serve-mfe
```

Now if we navigate to [https://localhost:4200](https://localhost:4200), we’ll be presented with:

![](/blog/images/2022-01-26/0*6IBuJzDm7mAiHC08.avif)

The Dashboard app tried to route to `/todo` but since we are not authenticated, it redirected us to `/login`. Both of these have been fetched via a network request from our other served apps.

We can verify this if we look at our Network Tab:

![](/blog/images/2022-01-26/0*RfVdGT2Bxap_hCq6.avif)

We requested the built components from our other served apps!

If we try to log in using the credentials:

- Username: anything
- Password: password

Nothing happens.

This is because our Micro Frontend architecture is currently rebundling our `@mfe-netlfiy/shared/auth` package into each app. Each app has its own injector tree which creates a new instance of the Service for each app in-memory. Therefore, each app has its own service which remains internal to each application that uses it. The applications are not sharing state.

> We built this auth package in the previous article, you can check that out here [Build and Deploy the Remote Applications to Netlify](/blog/build-and-deploy-the-remote-applications-to-netlify)

We can fix that by opening the webpack config for both our Dashboard and Login apps and adding `@mfe-netlfiy/shared/auth` to the shared mappings at the top of the file:

This registers with Webpack that our library should be code-split into its own bundle. Each app that registers the library will bundle it to the same filename. Therefore, in a micro frontend setup when we load the remote app, it reuses the already loaded bundle from the host app. Therefore, there is only one instance of the Service so the state gets shared.

Now, if we re-serve our apps by re-running `nx run dashboard:serve-mfe` and follow the steps below to log in:

- Username: anything
- Password: password
- Click login

We get redirected correctly to `/todo` and see the following:

![](/blog/images/2022-01-26/0*6wBUKv84yGV2AF1z.avif)

Our Micro Frontend Architecture is now sharing state across the apps! It’s all working locally!

### Re-deploy to Netlify

Now we need to re-deploy it to Netlify. As we’ll be using static Module Federation, we need the deployed URLs of our remote applications as currently, it’s pointing to locally served apps. We can get these from Netlify.

1.  Go to [https://app.netlify.com](https://app.netlify.com).
2.  Click on each remote application site
3.  Take note of the URL for the site

In my case my URLs are:

- Todo App: [https://lucid-cray-c41a7f.netlify.app](https://lucid-cray-c41a7f.netlify.app)
- Login App: [https://wonderful-euclid-5a7ba0.netlify.app](https://wonderful-euclid-5a7ba0.netlify.app)

We now need to update our production Webpack config to point our apps to each of these URLs.

Open `apps/dashboard/webpack/prod.config.js` and change it to match the following:

Now, to redeploy it, we simply need to make a git commit and push a commit to our remote repository. Netlify will pick up the change and automatically redeploy our apps!

```
git add .
git commit -m “feat: integrate remote apps to dashboard”
git push
```

If we go to the deployed Dashboard URL, it should work.

My deployed Dashboard URL is: [https://trusting-wiles-249121.netlify.app/](https://trusting-wiles-249121.netlify.app/)

## Conclusion

With that, our Micro Frontend-based setup is complete! We built and deployed three apps and integrated two of them using Module Federation into a single system, deployed on Netlify.

**Improvements to explore**

Right now, anytime we push a commit to our repository, all apps are being redeployed. We can fix this to only deploy apps that are being affected by changes we’ve made.  
We can use

- Ignore Builds configuration in the `netlify.toml`. [https://docs.netlify.com/configure-builds/file-based-configuration/#ignore-builds](https://docs.netlify.com/configure-builds/file-based-configuration/#ignore-builds)
- [Rares](https://twitter.com/__rares)’ article on deploying Nx monorepos with Netlify [https://www.netlify.com/blog/2020/04/21/deploying-nx-monorepos-to-netlify/](https://www.netlify.com/blog/2020/04/21/deploying-nx-monorepos-to-netlify/)

**Further Reading**

You can read more on Module Federation and Micro Frontends with Angular in [Manfred Steyer](https://twitter.com/ManfredSteyer)’s articles series: [https://www.angulararchitects.io/en/aktuelles/the-microfrontend-revolution-module-federation-in-webpack-5/](https://www.angulararchitects.io/en/aktuelles/the-microfrontend-revolution-module-federation-in-webpack-5/)

If you have enjoyed this series, check out the links below to stay informed of any future content!

Blog: [https://nx/dev/blog/](/blog)  
Nx on Twitter: [https://twitter.com/NxDevTools](https://twitter.com/NxDevTools)  
Colum Ferry’s Twitter: [https://twitter.com/FerryColum](https://twitter.com/FerryColum)
