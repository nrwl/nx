---
title: 'Metaprogramming, Higher-Order Components and Mixins with Angular Ivy'
slug: 'metaprogramming-higher-order-components-and-mixins-with-angular-ivy'
authors: ['Victor Savkin']
cover_image: '/blog/images/2018-12-07/1*wl1I1WxI70Zoc3Hs9G101g.png'
tags: [nx]
---

Everyone in the Angular community is excited about the approaching release of Ivy — the new Angular renderer.

- Ivy makes Angular faster.
- Ivy tree shakes better (the hello world Angular app built with it is under 4k).
- Ivy simplifies the generated code making Angular easier to debug.
- Ivy streamlines the build pipeline (no more metadata or ngfactory files) making things like lazy-loading individual component trivial.

I’m excited about all of these. But deep down the thing I’m excited about the most is something else.

**Ivy makes Angular dynamic. It enables metaprogramming, and makes things like mixins and higher-order components trivial to implement.**

![](/blog/images/2018-12-07/1*9McDGpqiVh3sZ_CK74sxXw.avif)

## How to Use Ivy to Do Metaprogramming

Let’s take an example: reading data from the NgRx store. Right now, we would implement it like this:

To see how we can use Ivy to do metaprogramming, let’s see what this component is compiled into.

One could write a whole post about this data structure and how Angular uses it. One could also write a series of posts on how the compiler uses the incremental DOM technique to render templates into sets of instructions. Those are interesting topics, but not the topics of this post.

In this post, let’s focus on the factory part of the data structure:

Angular will use the factory function to create a `TodosComponent`. `directiveInject` will walk up the node injector tree (think of walking up the DOM) trying to find the `Store` service. If it cannot find it, it will walk the module injector tree.

### Dynamism

Angular will use `ngComponentDef` when instantiating and rendering the component, at runtime. This means that we can write a decorator modifying this data structure.

We can then apply to our component class, as follows:

This works but with a big caveat — **it breaks tree shaking**. Why? Because the trees shaker will treat `FromStore` as a side-effectful function. We know that `FromStore` changes only `TodosComponent` itself, but the tree shaker has no way of knowing that. This is a big problem. After all, better tree shaking is one of the key advantages of the Ivy renderer.

**Thankfully, there is a solution.**

### Features

The solution is to define a function that takes the `ComponentDef` and adds the behavior to it

This function will need to added to the `ngComponentRef` property.

The array of features serve the same purpose as the decorator we defined above. It allows us to modify the `ngComponentDef` data structure, with one important difference: it doesn’t break tree shaking.

Why are we adding the `fromStore` into compiled code?

The Ivy renderer itself supports features, but the compiler turning `@Component` into `ngComponentDef` doesn’t. So, as of know, we cannot add it to the component decorator, but the following API (or something similar) should become available:

### HOCs and Mixins

Using this capability, and also the ability to generate templates on the fly, we can easily write a feature wrapping a component into another component, or mixing behavior into existing components. In other words, Ivy makes higher-order components and mixins not just possible but easy.

## Why Use Metaprogramming

We can use metaprogramming to achieve two things.

- **We can encapsulate established code patterns making our components more concise**. Fun fact: early on, before Angular 2 came out, I had a special set of decorators that would rely on conventions and would make the component declaration a lot shorter. I called it “the hipster mode”. Ivy makes it possible again.
- **We can experiment with new framework features, without making changes to the framework itself.**
- **We can evolve libraries without introducing breaking changes.**
- …

But there is a price:

- **The code can be harder to follow.** In the example above, if you don’t know what FromStore does, we might have a problem understanding how the todos observable is created.
- **The code can become less toolable.** The example above is not bad: WebStorm/VSCode will still be able to provide autocompletion in the template, but it is easy to go overboard and lose the toolability that Angular provides know.

### Word of Caution

The current focus of the Angular team is to make Ivy fully backwards-compatible. The official documentation on how to do metaprogramming will come after.

## Summary

The Ivy renderer brings a lot of goodness to Angular. It makes the framework faster, smaller, and simpler. Ivy also makes Angular more flexible by adding the dynamism, which we can use to do metaprogramming, implement higher-order components and mixins.

![](/blog/images/2018-12-07/1*9McDGpqiVh3sZ_CK74sxXw.avif)

### Victor Savkin is a co-founder of Nx. We help companies develop like Google since 2016.

![](/blog/images/2018-12-07/0*4HpWdaQEPIQr1EDw.avif)

_If you liked this, follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
