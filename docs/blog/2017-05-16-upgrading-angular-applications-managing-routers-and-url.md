---
title: 'Upgrading Angular Applications: Managing Routers and URL'
slug: 'upgrading-angular-applications-managing-routers-and-url'
authors: ['Victor Savkin']
cover_image: '/blog/images/2017-05-16/1*vjkgb2luo1VpqGvC62RsZg.png'
tags: [nx, release]
---

_Victor Savkin is a co-founder of_ [_nrwl.io_](https://goo.gl/v4nh0p)_, providing Angular consulting to enterprise teams. He was previously on the Angular core team at Google, and built the dependency injection, change detection, forms, and router modules._

**Many organizations have large AngularJS 1.x applications deployed to production.** These applications may be built by multiple teams from different lines of business. They may use different routers and state management strategies. **Rewriting such applications all at once, or big bang migrations, is not just impractical, it is often impossible**, and mainly for business reasons. **We need to do gradually,** and this is what this series of articles is about.

## Read the Series

This is the fourth post in the Upgrading Angular Applications series.

- [NgUpgrade in Depth](https://medium.com/ngupgrade-in-depth-436a52298a00)
- [Upgrade Shell](https://medium.com/upgrading-angular-applications-upgrade-shell-4d4f4a7e7f7b)
- [Two Approaches to Upgrading Angular Applications](https://medium.com/two-approaches-to-upgrading-angular-apps-6350b33384e3)

**Most AngularJS applications use some sort of router, so do most Angular applications. This means that upgrading an application always involves coordinating the two routers and managing the URL.**

In this article we will look at why it is a hard problem, what kind of setups application typically have, and a few strategies that can make solving this problem easier.

## Why Managing URL is Hard?

The URL, or to be more specific _window.location_, is a global and mutable resource. And as such, managing it is tricky. In particular, when multiple frameworks with multiple routers interact with it. Since we often have multiple routers active during the upgrade process, we need to know how to do it right.

There are two URL-managing setups we can use during upgrade: single ownership and mixed ownership.

## Single Ownership

Say we have an application with the following four routes:

![](/blog/images/2017-05-16/0*E_3xhNbIgEt-w04E.avif)

Now, say we used the “Vertical Slicing” strategy ([see here](https://medium.com/two-approaches-to-upgrading-angular-apps-6350b33384e3)) to upgrade a few of those routes to Angular.

![](/blog/images/2017-05-16/0*Mygyusx2bweTZk39.avif)

In the single-ownership setup, the features upgraded to Angular are managed by the Angular router. And the ones still in AngularJS are managed by the AngularJS router (or the UI router). In other words, **every route has a single owner: either the AngularJS Router or the new Angular Router.**

## Mixed Ownership

**In the mixed-ownership setup one URL can be managed by both the AngularJS Router and the Angular Router. One section is managed by AngularJS and the other one by Angular.**

![](/blog/images/2017-05-16/0*uLV1Vxfcz9naJKsI.avif)

It often happens when we want to show a dialog written in AngularJS, whereas the rest of our application has already been upgraded.

## Single Ownership or Mixed Ownership?

**If possible, we should use the single ownership setup. With it we will always have clear transitions between the upgraded and legacy parts of our application.** Only one router can update the URL at a time, so there will be no concurrency-related issues.

Now we’ve learned about the two main strategies, let’s see how we can implement them.

## Sibling Outlets

Sibling Outlets is one of the most useful strategies we can employ during the upgrade of an application using multiple routers. There are many ways to implement it. In this article we will look at the simplest one, which hopefully will give you an idea on how to do it for your application.

We start by making our top-level component as simple as possible: it has a router-outlet Angular directive and an ng-view AngularJS directive. In other words, we have two sibling router outlets: one for Angular and the other one for AngularJS.

When using single-ownership setup, only one outlet is active at a time — the other one is empty. In the mixed-ownership setup, both of them can be active simultaneously.

### Configuring Angular

Next, we define the routes for the upgraded feature in the Angular router configuration.

Finally, we need to tell the router to only handle URLs starting with _‘feature1’_, so it doesn’t error when it sees “legacy” URLs. There are two main ways to do it: by overriding a _UrlHandlingStrategy_ and by using an empty-path “sink” route.

### Overriding UrlHandlingStrategy

We can provide a custom URL handling strategy to tell the Angular router which URLs it should process. When it sees a URL that does not match the criteria, it will unload all the components emptying the root router outlet.

### Implementing a Sink Route

The Angular router processes its routes in order. So if we put an empty-path route at the end of the list, it will match any URL that is not matched by upgraded routes. And if we make it render an empty component, we will achieve a similar result to the one above.

We will look at sink routes more in future articles, when we show how to load the AngularJS part of our application lazily.

This is what our Angular configuration looks like. Now let’s see what we need to do to configure the AngularJS part of the app.

### Configuring AngularJS

We still configure the legacy routes using the $routeProvider.

As you can see the setup above uses a sink route, but we can handle upgraded routes in a way that is similar to providing a custom URL handling strategy. For instance, if we use the UI router, we can subscribe to _‘$stateChangeStart’_ and call _‘preventDefault’_ when navigating to the upgraded part of the application.

## Summary

**Most AngularJS and Angular applications use some sort of router, this means that upgrading an application always involves coordinating the two routers and managing the URL. This can be tricky because the URL is a global and mutable resource.**

In this article we looked at the two URL-managing setups we can use during upgrade: single ownership and mixed ownership. In the single-ownership setup, every route has a single owner: either the AngularJS Router or the new Angular Router. In the mixed-ownership setup, the same route can be handled by both. We talked about which one we should use and when.

Then we looked at the Sibling Outlets strategy we often use to upgrade applications using multiple routers.

## Upgrading Angular Applications Book

This article is based on the Upgrading Angular Applications book, which you can find here [https://leanpub.com/ngupgrade](https://leanpub.com/ngupgrade). If you enjoy the article, check out the book!

### Victor Savkin is a co-founder of [Nrwl — Enterprise Angular Consulting.](http://nrwl.io)

![](/blog/images/2017-05-16/1*s76h75v7CB7g4EuxVNaGkg.avif)

_If you liked this, click the💚 below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about Angular._
