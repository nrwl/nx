---
title: 'Using NgUpgrade Like a Pro: Lazy Loading AngularJS Applications'
slug: 'using-ngupgrade-like-a-pro-lazy-loading-angularjs-applications'
authors: ['Victor Savkin']
cover_image: '/blog/images/2017-05-25/1*m9s9gYY2Lnx6Lmi-V_hChQ.png'
tags: [nx, release]
---

_Victor Savkin is a co-founder of_ [_nrwl.io_](https://goo.gl/v4nh0p)_, providing Angular consulting to enterprise teams. He was previously on the Angular core team at Google, and built the dependency injection, change detection, forms, and router modules._

**One of the best things about the Angular router is its excellent support for lazy loading.** We can use it to make the initial bundle of our application as small as possible by only shipping to the client what is needed to render the application’s first screen.

**This series is about running our applications in the hybrid mode, where we use both AngularJS and Angular. One implication of this is that we have ship both of the frameworks to the client. We, however, don’t have to do it in the initial bundle.**

**In this article I will show how to set up a hybrid app such that AngularJS, NgUpgrade, and the existing AngularJS code are loaded lazily.**

![](/blog/images/2017-05-25/0*Jrk0RIYtiwqVs8WV.avif)

## Read the Series

This is the fifth post in the Upgrading Angular Applications series.

- [NgUpgrade in Depth](https://medium.com/ngupgrade-in-depth-436a52298a00)
- [Upgrade Shell](https://medium.com/upgrading-angular-applications-upgrade-shell-4d4f4a7e7f7b)
- [Two Approaches to Upgrading Angular Applications](https://medium.com/two-approaches-to-upgrading-angular-apps-6350b33384e3)
- [Managing Routers and URL](https://medium.com/upgrading-angular-applications-managing-routers-and-url-ca5588290aaa)

## Dual Router Setup

Suppose our application has the following four routes, where the Angular application handles “_/angular_a”_ and “_/angular_b”_, and the existing AngularJS application (via the UI-router) handles “_/angularjs_a”_ and “_/angularjs_b”_.

```
_/angular\_a__/angular\_b__/angularjs\_a__/angularjs\_b_
```

Let’s also suppose that our application’s entry point is “_/angular_a”_.

![](/blog/images/2017-05-25/0*AIQCItCB7IvlyeK5.avif)

**Our goal is to treat this application as a regular Angular application and not worry about AngularJS, NgUpgrade or the UI-router until the user navigates to “_/angularjs_a”_ or “_/angularjs_b”_**. Only at that point we want to load the needed AngularJS code. Let’s see how we can do it.

## Sibling Outlets

As you can see the root component implements the Sibling Outlets strategy ([see here](https://medium.com/upgrading-angular-applications-managing-routers-and-url-ca5588290aaa)). It has a _<router-outlet>_ Angular directive and an _<div ui-view>_ AngularJS directive. In other words, it two sibling router outlets: one for Angular and the other one for AngularJS.

> Note that _<div ui-view>_ will remain a simple DOM element until AngularJS is loaded — only then the ui-view directive will be place there.

## AngularJS Application

To illustrate this example, let’s sketch out a simple AngularJS application using the UI-router.

To make this AngularJS application ready for the hybrid app, let’s add a sink state to capture unmatched URLs, which, we assume, will be handled by the Angular application.

## Angular Application

Next, let’s sketch out an Angular application.

And similar to the AngularJS application, let’s define a sink route to capture unmatched URLs.

The Angular application assumes that unmatched URLs are handled by AngularJS. For this to work we need to load AngularJS first, and that’s what the _{path: ‘’, loadChildren: ‘./angularjs.module#AngularJSModule’}_ route does.

## Loading AngularJS

_AngularJSModule_ is a thin Angular wrapper around our existing AngularJS application.

To make the Angular router happy, we render an empty component. More importantly, we bootstrap the AngularJS application and set up the location synchronization.

## Overview

**Now when we have looked at all the pieces separately, let’s see how they work together.**

**When the user loads the page,** the Angular application will get bootstrapped: The Angular router will redirect to _’/angular_a’_, will instantiate _AngularAComponent_ and will place it into _<router-outlet>_ Defined in _AppComponet_.

Note we haven’t loaded AngularJS, NgUpgrade, or the existing AngularJS application yet, and navigating from _’/angular_a’_ to _’/angular_b’_ and back does not change that.

**When the user navigates to _’/angularjs_a’_,** the Angular router will match the _{path: ‘’, loadChildren: ‘./angularjs.module#AngularJSModule’}_ route, which will load _AngularJSModule_.

The bundle chunk containing the module will also contain AngularJS, _NgUpgrade_, and the existing AngularJS application.

Once loaded, the module will call _upgrade.bootstrap_. This will trigger the UI-router, which will match the ‘_angularjs_a’_ state and will place it into _<div ui-view>_. At the same time the Angular router will place an _EmptyComponent_ into _<router-outlet>_.

When the user navigates from _’/angularjs_a’_ to _’/angularjs_b’_ and back, the Angular router will keep matching the sink route, and the UI-router will update the _<div ui-view>_.

**When the user navigates from _’/angularjs_a’_ to _’/angular_a’_,** the UI-router will match its sink route and will place an empty template into _<div ui-view>_. The _setUpLocationSync_ helper will notify the Angular router about the URL change. The Angular router will match the URL and will place _AngularAComponent_ into _<router-outlet>_.

Note, the AngularJS application keeps running — it does not unloaded (it is almost impossible to unload a real-world _AngularJS_ application, so we have to keep it in memory).

When the user navigates from _’/angular_a’_ to _’/angular_b’_ and back, the UI-router will keep matching its sink route, and the Angular router will update _<router-outlet>_.

**Finally, when the user goes back to _’/angularjs_a’_,** the Angular router will match its sink route. And the UI-router, which is already running, will match the appropriate state. This time we haven’t had to load or bootstrap the AngularJS application because it is only done once.

## Preloading

As it stand right now, we will load _AngularJS_ when and only when the user navigates to a route handled by _AngularJS_. This makes the initial load fast, but makes the user’s first navigation to _’/angularjs_a’_ slow. We can fix it by enabling preloading.

With this in place, the router will preload _AngularJSModule_ (and, as a result, _AngularJS_, _NgUpgrade_, and the existing AngularJS app) in the background while the user is interacting with our application. You can learn more about this in the [Angular Router: Preloading Modules](https://vsavkin.com/angular-router-preloading-modules-ba3c75e424cb) article.

More interestingly, the router will instantiate _AngularJSModule_, which in turn will bootstrap the AngularJS application. This means that the application will be instantiated in the background as well.

And that’s how we get the best of both worlds: our initial bundle is small and subsequent navigations are instant.

## Code Samples

- [The code samples showing how to load AngularJS lazily](https://github.com/vsavkin/upgrade-book-examples/tree/master/lazyloading).

## Upgrading Angular Applications Book

This article is based on the Upgrading Angular Applications book, which you can find here [https://leanpub.com/ngupgrade](https://leanpub.com/ngupgrade). If you enjoy the article, check out the book!

### Victor Savkin is a co-founder of [Nrwl](https://nrwl.io). We help companies develop like Google since 2016. We provide consulting, engineering and tools.

![](/blog/images/2017-05-25/0*4HpWdaQEPIQr1EDw.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
