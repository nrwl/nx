---
title: 'Who Gave JavaScript a Build Step?!?'
slug: who-gave-js-a-build-step
authors: [Zack DeRose]
tags: []
cover_image: /blog/images/2025-01-09/thumbnail.avif
description: 'Explore the evolution of JavaScript build tools with Webpack maintainer Zack Jackson, from simple script tags to modern bundling solutions.'
---

JavaScript is awesome for many reasons. Not the least of these is as an interpreted language, we can actually send our JavaScript as-is over HTTP just as plain text right to a browser.

So how did we take something so simple and straightforward and mess it up to the point where we actually gave our JavaScript code a build step? Why are we web-packing? What is a Vite? And why do we hate ourselves?

I sat down with Zack Jackson - maintainer of the [Webpack](https://webpack.js.org/) and [Rspack](https://rspack.dev/) bundlers, and creator of Module Federation to get the answers to these burning questions. Part 1 is here where we talk a good bit about the history of bundlers (I'll throw part 2 a little further down):

{% youtube
src="https://www.youtube.com/watch?v=ma_c6UNHddI"
title="Zack Jackson: Everything You Ever Wanted To Know About Web Bundlers (and Rspack!)"
width="100%"
/%}

![The History of Bundlers](/blog/images/2025-01-09/bundler-gen-chart.png)

## Why A Build Step

Now that you're here and past the first few paragraphs, we can drop the clickbait facade.

We all _kinda_ know why we have a build step for our JavaScript. An entire over-simplification, but this is essentially what we're going for:

!["The build step"](/blog/images/2025-01-09/the-build-step.png)

We have an "Input format" that represents a format that we want to work with while developing. This should be human-readable, logically organized, and generally conducive to the process of development.

Then we have an "Output format" that represents what we'd like to ship, and the priorities here are very much efficiency-focused. We want to ship code that is functionally equivalent to the code from our "Input format", but we want to ship it in a way that has as few network requests as possible, with files that are as small as possible, and ideally we are always only sending code that is needed for the application to function properly for the current page or state - no more (or else we wasted sending code to the user's browser that is just not getting used) and no less (or else the application won't function properly).

The representation of this "build step" as a "black box" in the image above is very much on purpose. In most cases, I think an appropriately pragmatically-minded engineer (read this as a "good engineer") should probably not over-obsess with what this build process looks like. Preferably, you'd use the many available tools to leverage the work done by other engineers and the wider ecosystem to leverage work done by engineers focused on this problem.

## Inhale and Exhale: The Core Dimension

The "core dimension" as I like to think of it, comes down to "bundling" and "code-splitting". We'll hit the other dimensions later, but for the most part, those dimensions of the problem are either splintering of this core dimension, or somewhat ancillary to this core dimension.

"Bundling" refers to bundling up all the javascript files or "modules" of your application (and yes, that includes the black hole on your hard drive that is your `node_modules`) and bundling it all up into 1 file.

We'll flesh that process just a bit more because that's all very hand-wavey.

The first step of bundling is creating a graph of those "modules" mentioned. This graph will represent how each module depends on the others. From there, we _could_ collapse that entire graph into the 1 massive monolithic file, by replacing `import` or `require` statements with the contents of the code being imported. The reality is we often don't immediately, the graph itself is a good enough representation of that one file that we don't have to actually create the file, but you could think of it the same, because functionally, they're pretty much equivalent.

I like to think of bundling as an "inhale", where we gather up all your code into the module graph (or the 1 file).

From here we move into the "exhale", or the "code-splitting." The motivation here is without such a step, we could send over all our javascript in one shot with a single `script` tag:

```html {% filename="index.html" %}
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Webapp</title>
  </head>
  <body>
    <div id="app">
      <!-- Content will be injected by the JavaScript application -->
    </div>

    <!-- Reference to the bundled JavaScript -->
    <script src="main.js"></script>
  </body>
</html>
```

This is good: after the html comes in, we only need to make 1 request for all the javascript we need.

But this is also very very bad: if that 1 shot of javascript is massive, we end up waiting a long time for it all to arrive before our users can interact with the site.

When we utilize "code-splitting", we're "chunking" that 1 massive javascript file into smaller pieces, so that our `main.js` file can be small - just enough to "bootstrap" the application so the user can interact with it as soon as possible. When we use this approach, our `index.html` actually remains the same, but the `main.js` file will include code to dynamically load other chunks of javascript as we need them.

Our bundler is capable of automating some of this code-splitting for us, but by using [dynamic `import()` statements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import), we can signal to most bundlers to create dynamic chunks around those imports. This can be particularly effective when using a router on your application - to ensure that the code for each route is dynamically loaded when the route is activated.

Let's break down code-splitting with an actual example. Imagine you're building a single-page application (SPA) with React and `react-router` that dynamically loads components for each route:

```tsx {% filename="app.tsx" %}
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router';

const Bar = React.lazy(() => import('./bar'));
const Foo = React.lazy(() => import('./foo'));

function App() {
  return (
    <Router>
      <nav>
        <Link to="/">Foo</Link>
        <Link to="/bar">Bar</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Foo />} />
        <Route path="/bar" element={<Bar />} />
      </Routes>
    </Router>
  );
}

export default App;
```

When building this (we'll use vite for this example), the bundler creates separate files for each chunk:

```shell
> vite build

vite v5.4.11 building for production...
✓ 42 modules transformed.
../../dist/apps/my-webapp/index.html                   0.48 kB │ gzip:  0.30 kB
../../dist/apps/my-webapp/assets/foo-DjRQIFuQ.js       0.16 kB │ gzip:  0.15 kB
../../dist/apps/my-webapp/assets/bar-oew334y7.js       0.22 kB │ gzip:  0.19 kB
../../dist/apps/my-webapp/assets/index-3-BhaWR_.js   177.96 kB │ gzip: 58.71 kB
✓ built in 589ms
```

This way, our bundler creates a separate "chunk" per route, and the chunk can be dynamically loaded when it is needed.

This code-splitting then operates as the "exhale". Essentially, we move from a series of files we are working with as we develop, "inhale" them into "the graph", then "exhale", splitting them into their respective chunks - a different set of files optimized for your built artifact.

## The Other Dimensions

I view the rest of these as somewhat secondary to the core dimension above, but they're still worth mentioning!

### Non-JS Assets

Similar bundling is required for non-js assets, the most significant for front-end projects is usually css (where similar bundling/splitting strategies come into play), but other assets like images and fonts also need to end up in the final artifact, and things need to work in terms of where these assets are located in the subdirectories and where your javascript and html reference these!

Bundlers handle these as well.

### Transpilation / Polyfilling

Transpilation mainly refers to the process of transforming your Typescript files from Typescript (which a browser can't understand) to JavaScript (which a browser can understand!).

Typescript serves as a way of placing typing assertions on our code to make sure we don't have errors in our code that violate our typing instructions. We can think of type-checking our code as a "lint step" - something that we should run before committing code into our codebase via [Continuous Integration](/ci), but this type-check step we can safely view as separate from our "build step." From the perspective of our "build step" we're usually looking at simply stripping out the types from your code to create valid JavaScript.

Transpilation can also refer to adjusting the code we write in to code that browsers support. In prior days, tools like [Babel](https://babeljs.io/) were required to "transpile" down from ES6 javascript to ES5. Tools like Babel are still widely used, to support [esnext](https://developer.mozilla.org/en-US/docs/Web/JavaScript/JavaScript_technologies_overview#standardization_process) features that browsers don't support yet. This is also referred to as polyfilling sometimes - as in polyfilling a JS feature that is not supported yet by browsers, or sometimes for features that can be optionally loaded by specific browsers that are missing various features.

### "Last Mile" Optimizations

There's a series of other optimizations that bundlers perform as part of the build step, the main ones that come to mind here are:

- **Minification** - reduces file size by reducing whitespace to minimum, removing any superfluous text, and shortening all variable names
- **Tree Shaking** - Analyzes the Abstract Syntax Tree (AST) of your bundled graph for unreferenced branches of the overall tree. Those unreferenced branches are then "shaken off" so this code does not end up in your end artifact.
- **Cache Busting** - Appends hashes to filenames (e.g., `main-[hash].js`) to ensure browsers load updated files after a deployment.

Some may consider code splitting a "last mile" optimization as well, and some other items like creating source maps for a development build or asset optimization could be seen as a last-mile optimization as well.

### Module Formats

EcmaScript Modules (or ESM or `"type": "module"` or `.mjs`) vs. CommonJS modules (or `require` or `"type": "common"` or `.cjs`) is another terrible dimension of this whole discussion.

Quoting from [an article I read on this topic that rang especially true](https://redfin.engineering/node-modules-at-war-why-commonjs-and-es-modules-cant-get-along-9617135eeca1):

> Superficially, ESM looks very similar to CJS, but their implementations couldn't be more different. One of them is a honey bee, and the other is a murder hornet. But I can never remember which one is which.

The ESM module format uses `import` statements to bring in other modules, and `export` statements to mark public/consumable pieces of a module.

CommonJS module format uses `require` statements to bring in other modules, and `module.exports = ...` statements to mark public/consumable pieces of a module.

But it's unfortunately a bit more complicated than that, but that's beyond the scope of this article. There's other formats too, like AMD (Asynchronous module definition, popular in legacy browser projects) and UMD (a universal format that works in both Node.js and the browser)

Bundlers are great, cuz they pave over much of this headache - allowing you to write your code in either module format or even in a bit of both, and exporting to what makes most sense. Typically you'd target esm, as that's the current consensus for front-end applications.

### Building for Other Purposes

Another interesting dimension is building for other purposes than simply front-end apps.

One interesting alternative here is building a package to publish to npm or a private registry. There's a parallel set of concerns here, you still have a desired input format that probably looks very similar! But you have entirely different priorities for your output format! Size is largely unimportant, as `node_modules` are already an endless black hole of bytes, there's no sense fretting over adding a few more megs on that heap.

That's mainly a joke - but the idea is your end consumer would figure out minification and etcetera when running their own build step.

You also don't really need to "bundle" in your dependencies, as you can simply reference other dependencies in your exported `package.json` for your consumer to bring in. You do typically need to worry about types - typically building to `.js` files, but providing `d.ts` files to inform the typing of your package.

Another alternative is building for backend node applications. Different priorities here too as bundle size isn't all that important - but some interesting folds can come in around Module Federation on the backend.

## Wrapping it up

Here's the part 2 of my discussion with Zack Jackson - where we go a bit deeper, laying out the rough map of bundler lifecycle hooks and diving into webpack source code a bit to see it in action:

{% youtube
src="https://www.youtube.com/watch?v=RE1AzJIcbdk"
title="Everything You Need To Know About Bundlers! Part 2 w/ Zack Jackson (RsPack creator)"
width="100%" /%}

![The General Bundler Path](/blog/images/2025-01-09/bundler-flow-chart.png)

Jump into [our discord](https://go.nx.dev/community) if you have more questions, but I think the gist of it is summarized by this image:

!["The build step"](/blog/images/2025-01-09/the-build-step.png)

We have an input format we want to work with - and an output format that we want to export our artifact in. Generally, your build step should be a black-box of getting you from that input format to your output format. This article hopefully helped you flesh out that black box just a bit - at least enough to point you in the right direction if you want to dig deeper!

## Learn More

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
