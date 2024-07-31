---
title: 'Upgrading Angular Applications: Upgrade Shell'
slug: 'upgrading-angular-applications-upgrade-shell'
authors: ['Victor Savkin']
cover_image: '/blog/images/2017-05-04/1*aW8snyXZEw1fM6rfozXY2Q.png'
tags: [nx, release]
---

_Victor Savkin is a co-founder of_ [_nrwl.io_](https://goo.gl/v4nh0p)_, providing Angular consulting to enterprise teams. He was previously on the Angular core team at Google, and built the dependency injection, change detection, forms, and router modules._

Many organizations have large AngularJS 1.x applications deployed to production. These applications may be built by multiple teams from different lines of business. They may use different routers and state management strategies. Rewriting such applications all at once, or big bang migrations, is not just impractical, it is often impossible, and mainly for business reasons. We need to do gradually, and this is what this series of articles is about.

In this article we will look at the strategy used in most upgrade projects called “Upgrade Shell”.

## Read the Series

This is the second post in the Upgrading Angular Applications series.

- [Upgrading Angular Applications: NgUpgrade in Depth](https://medium.com/ngupgrade-in-depth-436a52298a00)

## Upgrade Shell Strategy

When applying the Upgrade Shell strategy, we take an AngularJS application, and replace its root component with a new Angular component. If the application does not have a root component, we introduce one.

![](/blog/images/2017-05-04/0*d1UcYALRAYQElVw4.avif)

## Implementation

Let’s look at the simplest way to implement this strategy.

We start with our existing AngularJS application defined and bootstrapped as follows:

First, we remove the _bootstrap_ call.

Then we define a root component rendering a single element with the _ng-view_ class applied.

Next, We downgrade it and register with the AngularJS module.

Next, we define an Angular module importing _UpgradeModule_.

We use the injected _UpgradeModule_ to bootstrap the existing AngularJS application in _ngDoBootstrap_. For the upgrade to work property, _upgrade.bootstrap_ has to be called inside the Angular zone, and doing it in _ngDoBootstrap_ achieves that.

With this setup in place, the order of events during bootstrap will look as follows:

- Angular application bootstraps.
- AngularJS application bootstraps.
- _AppComponent_ gets created.
- AngularJS router kicks in and inserts its view into the _ng-view_.

### **Summary**

This strategy is a good first step of upgrading an app. It takes five minutes to implement. And what we are getting at the end is technically a new Angular application, even though the meat of the app is still written in AngularJS.

## Upgrading Angular Applications Book

This article is based on the Upgrading Angular Applications book, which you can find here [https://leanpub.com/ngupgrade](https://leanpub.com/ngupgrade). If you enjoy the article, check out the book!

### Victor Savkin is a co-founder of [Nrwl](https://nrwl.io). We help companies develop like Google since 2016. We provide consulting, engineering and tools.

![](/blog/images/2017-05-04/0*4HpWdaQEPIQr1EDw.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
