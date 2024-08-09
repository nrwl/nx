---
title: 'Angular: Is AOT Worth It?'
slug: 'angular-is-aot-worth-it'
authors: ['Jeff Cross']
cover_image: '/blog/images/2016-12-21/1*bFpua6ePeJsYTjJQoXyUqQ.png'
tags: [nx, release]
---

_Jeff Cross is a co-founder of_ [_nrwl.io_](https://goo.gl/v4nh0p)_, providing Angular consulting to enterprise teams. He was previously Tech Lead of the Angular Mobile team at Google._

Much of Angular’s magic is in its compiler, both in Angular 1 and Angular 2. The compiler is what takes an application’s directives and components, along with their corresponding HTML and CSS, and creates component factories to quickly stamp out instances with all of their view creation logic.

In Angular 1, and for most of Angular 2’s life, there has just been the JIT (just in time) compiler, the compiler that runs in the browser. When an Angular 2 application is bootstrapped in the browser, the JIT compiler performs a lot of work to analyze the components in the application at runtime and generate code in memory. When the page is refreshed, all the work that has been done is thrown away, and the JIT compiler does the work all over again.

One day, [Tobias Bosch](https://twitter.com/tbosch1009) and [Misko Hevery](https://twitter.com/mhevery) had a thought… why not do compilation as a build step? Several months later, AOT (ahead of time) compilation was born. At first it was called the “offline compiler,” but “offline” is a pretty overloaded term, and AOT is a nice complement to JIT.

With the AOT compiler, Angular apps can be built to not require much of the compiler, change detection, or dependency injection systems at runtime. This leads to a significantly smaller application payload. And since the component factories are generated at build time, Angular can skip the compilation and move straight to creating views at runtime.

So apps can be smaller, and require less work. What’s the actual user impact of AOT?

We’ll take a look at a couple of apps, and measure the total time to bootstrap the application, from the time the page begins loading, to the time when Angular’s bootstrap is complete. We’ll also measure the total JS payload size with and without AOT.

## Angular CLI

Let’s take a look at an app built with Angular CLI using AOT, compared to the same Angular CLI app not using AOT. Using Angular CLI 1.0.0-beta.22–1. We’ll use the bare app created by CLI, the only difference being that we’ll pass the aot flag for one version and not the other. Passing the --aot flag tells CLI to use ahead of time compilation when building the app.

The AOT version of the app can be found [here](https://aot-examples.firebaseapp.com/hello-aot/), and the non-AOT version can be found [here](https://aot-examples.firebaseapp.com/hello-no-aot/).

## Results

The results displayed below are from testing both versions of the app on webpagetest.org (a great performance tool if you haven’t used it), testing on a Galaxy S7 with Fast 3G emulation. I used the [User Timing API](https://developer.mozilla.org/en-US/docs/Web/API/User_Timing_API) to mark when Angular’s bootstrap was done, which automatically gets recorded in webpagetest.org results. You can view the actual results for AOT [here](https://www.webpagetest.org/result/161221_Y0_BCKA/), and for non-AOT [here](https://www.webpagetest.org/result/161221_FS_BCKC/).

## Total time to bootstrap

We’ll focus on the time it takes to bootstrap an application, which is a good indication of your application’s “time to interactive” score, since the app tends to be fully interactive when Angular is done bootstrapping. When measuring the total time from beginning page load to the point when Angular is finished bootstrapping, the difference is pretty drastic.

The AOT version of our application took **2,602ms** to load and bootstrap, while the JIT version took **4,804ms**. If we look at the “content breakdown” of each test, we can see that the AOT version has [101KB of JS](https://www.webpagetest.org/result/161221_Y0_BCKA/1/breakdown/) (gzip), while the non-AOT version has [190KB](https://www.webpagetest.org/result/161221_FS_BCKC/1/breakdown/) (gzip). In other words, the total JS payload for a Hello World application with Angular CLI is **89% larger** when using JIT mode.

We can see that simply using AoT for the most basic app can reduce payload size and drastically improve time-to-interactive. Now let’s take a look at a real-world application, and see how its total time to bootstrap compares between AOT and JIT.

## Code.gov

A few folks on the Angular team at Google and I have been helping optimize the [code.gov](https://code.gov) site, which is built with Angular 2. Currently, the site is using JIT compilation, but it will soon have AOT enabled. Let’s run the compare the site in JIT mode with an AOT-enabled version.

![[object HTMLElement]](/blog/images/2016-12-21/1*1UHhxMM3xqLUob4q-g6kag.avif)
_AOT: 3586ms, JIT: 5233ms_

Webpagetest.org results for AOT can be found [here](https://www.webpagetest.org/result/161221_BG_BCK8/), and JIT can be found [here](https://www.webpagetest.org/result/161221_G7_BCK9/). Testing under the same simulated conditions as our previous sample, the code.gov site has an impressive **31%** reduction in total time to bootstrap. Some of this improvement is thanks to the decreased JS payload size (**188KB** gzip AOT vs **274KB** gzip JIT), but what’s more interesting about this example is when we dig deeper and compare the Script processing time between [AOT](https://www.webpagetest.org/breakdownTimeline.php?test=161221_BG_BCK8&run=1) and [JIT](https://www.webpagetest.org/breakdownTimeline.php?test=161221_G7_BCK9&run=1).

![[object HTMLElement]](/blog/images/2016-12-21/1*TkiSNtnWQCpgr-zz-jtMTw.avif)
_AOT: 832ms, JIT: 2157ms_

Because AOT reduces the amount of JS code that needs to be parsed, as well as the amount of work needed to render the application, the overall script time is reduced by over **61%.**

## Use AOT Today

The performance improvements with AOT are too significant to ignore. And with the tooling available today, there’s more reason than ever to make the jump from JIT to AOT.

## Angular CLI

Both of the applications in this article are using Angular’s Webpack plugin, [@ngtools/webpack](https://www.npmjs.com/package/@ngtools/webpack), which handles AOT code generation and lazy loading. Angular CLI automatically uses this plugin for apps that are created with the aot flag, so to take advantage of it, just create a new app like so:

$ npm install -g angular-cli  
$ ng new hello-aot  
$ cd hello-aot  
$ ng build --aot --prod

(Update 12/21/16 1:19pm corrected steps for Angular CLI create and build. Thanks [Mike Brocchi](https://medium.com/u/eae5913abcc1?source=post_page-----8fa02eaf64d4--------------------------------))

(Note: eventually AOT will be the default mode in Angular CLI, and the --aot flag will not be required).

## Webpack

If using Webpack, install @ngtools/webpack follow the instructions on the [@ngtools/webpack](https://www.npmjs.com/package/@ngtools/webpack) package on npm.

## Compiler CLI

Angular also provides a command line compiler to generate factories manually. The package is available on npm as [@angular/compiler-cli](https://www.npmjs.com/package/@angular/compiler-cli), and a guide for using this approach can be found on the official angular docs: [https://angular.io/docs/ts/latest/cookbook/aot-compiler.html](https://angular.io/docs/ts/latest/cookbook/aot-compiler.html)

## In Summary

AOT compilation provides significant improvements to load time by reducing the amount of JS that ships to the browser, and by doing the bulk of compilation work at build time instead of in the browser. Using AOT has gotten much easier, and continues getting easier thanks to tools to add AOT to any project, regardless of build system. So if you’re not using AOT yet, and you care about your application loading quickly, now’s a great time to try add it to your build.

## Reference

The cited examples in this article can all be found at [https://aot-examples.firebaseapp.com/](https://aot-examples.firebaseapp.com/). Visit the different versions of the apps, and check out the timeline in Chrome Devtools. Webpagetest.org results for each of the apps can be found below (tested on Chrome in Samsung S7 with fast 3G):

1.  Code.gov with AOT: [https://www.webpagetest.org/result/161221_BG_BCK8/](https://www.webpagetest.org/result/161221_BG_BCK8/)
2.  Code.gov without AOT: [https://www.webpagetest.org/result/161221_G7_BCK9/](https://www.webpagetest.org/result/161221_G7_BCK9/)
3.  Angular CLI blank with AOT: [https://www.webpagetest.org/result/161221_Y0_BCKA/](https://www.webpagetest.org/result/161221_Y0_BCKA/)
4.  Angular CLI without AOT: [https://www.webpagetest.org/result/161221_FS_BCKC/](https://www.webpagetest.org/result/161221_FS_BCKC/)

### Jeff Cross is a co-founder of [Nrwl — Enterprise Angular Consulting.](http://nrwl.io)

![](/blog/images/2016-12-21/1*s76h75v7CB7g4EuxVNaGkg.avif)
