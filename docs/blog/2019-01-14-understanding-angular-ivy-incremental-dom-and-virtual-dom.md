---
title: '**Understanding Angular Ivy: Incremental DOM and Virtual DOM**'
slug: 'understanding-angular-ivy-incremental-dom-and-virtual-dom'
authors: ['Victor Savkin']
cover_image: '/blog/images/2019-01-14/1*wl1I1WxI70Zoc3Hs9G101g.png'
tags: [nx]
---

![](/blog/images/2019-01-14/1*9McDGpqiVh3sZ_CK74sxXw.avif)

Here at [Nrwl](/company), we’ve been sharing a lot of insights about Angular Ivy, as there is anticipation about what it will enable us and our clients to do. Angular Ivy is a new Angular renderer, which is radically different from anything we have seen in mainstream frameworks, because it uses incremental DOM.

**What is incremental DOM? How is it different from virtual DOM?**

Let’s compare them and see why incremental DOM is the right answer for Angular.

## How Virtual DOM Works

React was the first mainstream framework to use virtual DOM, which is defined by this key idea:

_Every component creates a new virtual DOM tree every time it gets rerendered. React compares the new virtual DOM tree with the old one and then applies a series of transformations to the browser DOM to match the new virtual DOM tree._

![](/blog/images/2019-01-14/1*48mwTh2nPA-_owlgwFK6Ew.avif)

**Virtual DOM has two main advantages:**

- We can use any programming language to implement the component’s render function, so we don’t need to compile anything. React developers mainly uses JSX, but we can use plain JavaScript as well.
- We get a value as a result of rendering component. It can be used for testing, debugging, etc..

## Incremental DOM

Incremental DOM is used internally at Google, and it is defined by this key idea:

_Every component gets compiled into a series of instructions. These instructions create DOM trees and update them in-place when the data changes._

For instance, the following component:

Will be compiled into:

The template function contains the instructions rendering and updating the DOM. Note that the instructions aren’t interpreted by the framework’s rendering engine. **They are the rendering engine.**

## Why Incremental DOM

Why did the Google team go with incremental DOM instead of virtual DOM?

**They have one goal in mind: applications have to perform well on mobile devices. This mainly meant optimizing two things: the bundle size and the memory footprint.**

To achieve the two goals:

- The rendering engine itself has to be tree shakable
- The rendering engine has to have low memory footprint

## Why Incremental DOM is Tree Shakable?

When using incremental DOM, the framework does not interpret the component. Instead, the component references instructions. If it doesn’t reference a particular instruction, it will never be used. And since we know this at compile time, we can omit the unused instruction from the bundle.

![](/blog/images/2019-01-14/1*6b-I9LFOBDy2awgf5xROqQ.avif)

Virtual DOM requires an interpreter. What part of that interpreter is needed and what part is not isn’t known at compile time, so we have to ship the whole thing to the browser.

![](/blog/images/2019-01-14/1*SGczWSmO23rMUMyzX3BtXA.avif)

## Why Incremental DOM Has Low Memory Footprint?

Virtual DOM creates a whole tree from scratch every time you rerender.

![](/blog/images/2019-01-14/1*ILRiBFf_PhCKHYEfPjuHwQ.avif)

Incremental DOM, on the other hand, doesn’t need any memory to rerender the view if it doesn’t change the DOM. We only have to allocate the memory when the DOM nodes are added or removed. And the size of the allocation is proportional to the size of the DOM change.

![](/blog/images/2019-01-14/1*3DcbCfvQWLNXTvo_4dYduA.avif)

Since most of render/template calls don’t change anything (or change very little), this can result in huge memory savings.

## It’s More Nuanced

Of course, it’s more nuanced. For example, having render return a value provides good affordances, say, for testing. On the other hand, being able to step through instructions using Firefox DevTools makes debugging and perf profiling easier. What ends being more ergonomic depends on the framework and the developer’s preferences.

## Ivy and Incremental DOM?

Angular has always been about using html and templates (a few years ago I wrote a post outlining why I think this is the right choice in the long run). That is why, the main advantage of virtual DOM could never apply to Angular.

Given this, plus the tree shakability and memory footprint of incremental DOM, I think it was the right choice to use incremental DOM as the foundation of the new rendering engine.

![](/blog/images/2019-01-14/0*m1IN8FG0qRCUBohc.avif)

### Victor Savkin is a co-founder of Nrwl. We help companies develop like Google, Facebook, and Microsoft since 2016. We provide consulting, engineering and tools.

![](/blog/images/2019-01-14/0*Num3x4vfVXNoDs7v.avif)

_If you liked this, follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
