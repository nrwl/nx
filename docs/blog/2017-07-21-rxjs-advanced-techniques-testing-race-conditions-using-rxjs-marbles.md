---
title: 'RxJS Advanced Techniques: Testing Race Conditions Using RxJS Marbles'
slug: 'rxjs-advanced-techniques-testing-race-conditions-using-rxjs-marbles'
authors: ['Victor Savkin']
cover_image: '/blog/images/2017-07-21/1*gSBFvuLWky8Mgb8gLIZeSg.png'
tags: [nx, release]
---

_Victor Savkin is a co-founder of_ [_nrwl.io_](https://goo.gl/IAi7JWß)_. He was previously on the Angular core team at Google, and built the dependency injection, change detection, forms, and router modules_

Building a web application involves coordinating multiple backends, web workers, and UI components, all of which update the application’s state concurrently. This makes it easy to introduce bugs due to race conditions. In this article I will show an example of such a bug, how to expose it in unit tests using RxJS marbles, and, finally, how to fix it.

_I’ll use Angular and RxJS, but everything I’ll talk about is true for any web application, regardless of the used framework._

## Problem

Let’s look at _MovieShowingsComponent_. It’s a simple component displaying movie showings. When the user selects a movie, the component will immediately display the selected title, and then, once it receives the response from the backend, will display the corresponding showings.

**This component has a race condition.** To see where, let’s imagine the following scenario. Say the user starts by selecting ‘After the Storm’, and then selects ‘Paterson’. This is what it will look like:

![](/blog/images/2017-07-21/1*9pXV-mI5o11bH7ORpleCtw.avif)

We are making one assumption here: the response for ‘After the Storm’ will come first. But what if this isn’t the case? What will happen if the response for ‘Paterson’ comes first?

![](/blog/images/2017-07-21/1*urd2_0lPVKS6UvDYV8g2aw.avif)

The application will say ‘Paterson’, but will display the showings for ‘After the Storm’ — it is broken.

Before we start fixing it, let’s write a unit test exposing this race condition. There are, of course, many ways to do it. But since we are using RxJS, we will use marbles — one of the most powerful and underused ways of testing concurrent code.

## Marbles

To use marble we need to install the _jasmine-marbles_ library.

```
npm install — save-dev jasmine-marbles
```

Before writing a test for the component, let’s look at how marble testing works in general by testing the _concat_ operator.

Here we create two observables _one$_ and _two$_, using the _cold_ helper provided by _jasmine-marbles_ (If you aren’t familiar with _hot_ and _cold_, read [this post](https://medium.com/@benlesh/hot-vs-cold-observables-f8094ed53339) by Ben Lesh.)

Next, we use the _concat_ operator to get the result observable, which we compare against the expected one.

**Marbles are a domain specific language for defining RxJS observables.** Using it we can define when our observables emit values, when they are idle, when they error, when they get subscribed to, and when they complete. In our test we define two observables, one of which (_’x-x|’_) emits an _‘x’_, then waits for 10 milliseconds, then emits another ‘_x’_, and then completes. And the other one waits for 10 milliseconds before emitting a ‘_y_’.

Often emitting single-letter strings isn’t sufficient. The _cold_ helper provides a way to map them to other objects, like this:

**As with many DSLs, we use marbles to improve the readability of our tests. Marbles do an excellent job at it — we can see what a test does by just glancing at it.**

If you want to learn more about testing, check out [this video](https://egghead.io/lessons/rxjs-introduction-to-rxjs-marble-testing)[.](https://egghead.io/lessons/rxjs-introduction-to-rxjs-marble-testing).)

## Testing Race Condition

Armed with this powerful tool, let’s write a unit test exposing the race condition.

## Fixing the Race Condition

Let’s look at our component one more time.

Every time the user select a movie, we create a new independent observable. If the user clicks twice, we will have two observables, which are not synchronized in any way. This is the source of the problem.

Let’s change it by introducing an observable of all _getShowings_ invocations.

Next, let’s map it to a list of showings.

**By doing this we replaced a collection of independent observables with a single observable of observables, which we can apply synchronization operators to.** And that’s what _switchMap_ is.

The _switchMap_ operator only subscribes to the latest invocation of _backend.getShowings_. If another invocation happens, it will unsubscribe from the one before.

![](/blog/images/2017-07-21/1*nECDraadsNw_9-3iUOg45Q.avif)

With this change our test will pass.

## Source Code

You can find the source code in [this repo](https://github.com/vsavkin/marble_testing_and_race_conditions). Note _”skipLibCheck”: true_ in _tsconfig.spec.json_.

## Summary

In this article we have looked at an example of a bug caused by a race condition. We used marbles, a powerful way to test async code, to expose this bug in a unit test. We then fixed the bug by refactoring our code to use a single observable of observables, which we applied _switchMap_ to.

### Victor Savkin is a co-founder of [Nrwl](https://nrwl.io). We help companies develop like Google since 2016. We provide consulting, engineering and tools.

![](/blog/images/2017-07-21/0*4HpWdaQEPIQr1EDw.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
