---
title: 'Two Approaches to Upgrading Angular Apps'
slug: 'two-approaches-to-upgrading-angular-apps'
authors: ['Victor Savkin']
cover_image: '/blog/images/2017-05-09/1*aW8snyXZEw1fM6rfozXY2Q.png'
tags: [nx, release]
---

_Victor Savkin is a co-founder of_ [_nrwl.io_](https://goo.gl/v4nh0p)_, providing Angular consulting to enterprise teams. He was previously on the Angular core team at Google, and built the dependency injection, change detection, forms, and router modules._

Many organizations have large AngularJS 1.x applications deployed to production. These applications may be built by multiple teams from different lines of business. They may use different routers and state management strategies. Rewriting such applications all at once, or big bang migrations, is not just impractical, it is often impossible, and mainly for business reasons. We need to do gradually, and this is what this series of articles is about.

In this article we will look at two main ways to approach upgrade: Vertical Slicing and Horizontal Slicing.

## Read the Series

This is the third post in the Upgrading Angular Applications series.

- [Upgrading Angular Applications: NgUpgrade in Depth](https://medium.com/ngupgrade-in-depth-436a52298a00)
- [Upgrading Angular Applications: Upgrade Shell](https://medium.com/upgrading-angular-applications-upgrade-shell-4d4f4a7e7f7b)

## Vertical Slicing

Once we have wrapped our AngularJS app into a shell ([see here](https://medium.com/upgrading-angular-applications-upgrade-shell-4d4f4a7e7f7b)), we can start upgrading the rest of the application. “Vertical Slicing” is one approach we can use.

Even though, it is not feasible to rewrite the whole application at once, it is often possible to do it route by route, screen by screen, or feature by feature. In which case the whole route is either written in AngularJS or in Angular.

![](/blog/images/2017-05-09/1*4OKl8RYmI5-mjelklRXKbA.avif)

In other words, everything we see on the screen is either written in AngularJS or in Angular.

![](/blog/images/2017-05-09/1*01DGo1KDfQTdCtDYqEDtDA.avif)

We can visualize this strategy as follows:

![](/blog/images/2017-05-09/0*37J8V1HKyYxAi41X.avif)

As you can see, while upgrading the second route, we had to duplicate one of the components. For a while we had two copies of that component: one written in AngularJS and the other in Angular. Such duplication is one of this approach’s downside.

## Horizontal Slicing

Horizontal slicing is the opposite strategy.

![](/blog/images/2017-05-09/1*ReBU5bHUKYOchFZb0Znqkw.avif)

We start with upgrading reusable components like inputs and date pickers. Then we upgrade the components using those. And we keep doing it until we work our way up to the root.

![](/blog/images/2017-05-09/0*qtXI94Ofy97pnn03.avif)

One major implication of this approach is that is that no matter what screen we open, we will have two frameworks acting at the same time.

![](/blog/images/2017-05-09/1*vIyPSXo-e914Drd4jFFBCQ.avif)

## Comparing Horizontal and Vertical Slicing

The major upside of the Vertical Slicing strategy is that we deal with one framework at a time. This means that our application is easier to debug and easier to understand.

Second, when using Vertical Slicing our upgrade process is encapsulated to a single route. This can be extremely important in large organizations with multiple teams working on the same project. Being able to do your work independently means that we won’t have to coordinate our work with other teams.

Finally, Vertical Slicing allows us to load NgUpgrade and AngularJS lazily, only when we need to render legacy routes. This makes our applications smaller and faster.

On the other hand, the Horizontal Slicing approach has one major advantage: it is finer grained. We can upgrade a component and ship it to production in a day, whereas upgrading a route may take months.

## Upgrading Angular Applications Book

This article is based on the Upgrading Angular Applications book, which you can find here [https://leanpub.com/ngupgrade](https://leanpub.com/ngupgrade). If you enjoy the article, check out the book!

### Victor Savkin is a co-founder of [Nrwl — Enterprise Angular Consulting.](http://nrwl.io)

![](/blog/images/2017-05-09/1*s76h75v7CB7g4EuxVNaGkg.avif)

_If you liked this, click the💚 below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about Angular._
