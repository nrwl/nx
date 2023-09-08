# Core Nx Tutorial - Step 1: Create Eleventy Blog

In this tutorial you create multiple projects in a monorepo and take advantage of the core Nx features with a minimum of configuration.

{% callout type="check" title="Package-Based Repo" %}
This tutorial sets up a [package-based repo](/concepts/integrated-vs-package-based). If you prefer an [integrated repo](/concepts/integrated-vs-package-based), check out the [React](/react-tutorial/1-code-generation), [Angular](/angular-tutorial/1-code-generation) or [Node](/getting-started/tutorials/node-server-tutorial) tutorials.
{% /callout %}

## Contents:

- [1 - Create Blog](/core-tutorial/01-create-blog)
- [2 - Create CLI](/core-tutorial/02-create-cli)
- [3 - Share Assets](/core-tutorial/03-share-assets)
- [4 - Build Affected Projects](/core-tutorial/04-build-affected-projects)
- [5 - Automatically Detect Dependencies](/core-tutorial/05-auto-detect-dependencies)
- [6 - Summary](/core-tutorial/06-summary)

## Create a New Workspace

**Start by creating a new workspace.**

```shell
npx create-nx-workspace@latest
```

You then receive the following prompts in your command line:

```shell
Workspace name (e.g., org name)         myorg
What to create in the new workspace     npm
```

> You can also choose to add [Nx Cloud](https://nx.app), but its not required for the tutorial.

```treeview
myorg/
├── packages/
├── tools/
├── nx.json
├── package.json
├── README.md
└── tsconfig.base.json
```

## Yarn workspaces

The `package.json` file contains this property:

```json
  "workspaces": [
    "packages/**"
  ]
```

Which tells yarn (or npm) and Nx to look in the `packages` folder for projects that will each be identified by a `package.json` file.

## Adding Eleventy

**Install Eleventy**

To install Eleventy run:

{% tabs %}
{% tab label="yarn" %}

```shell
yarn add -D -W @11ty/eleventy@1.0.0
```

{% /tab %}
{% tab label="npm" %}

```shell
npm install -D @11ty/eleventy@1.0.0
```

{% /tab %}
{% /tabs %}

{% callout type="check" title="Installing in workspace's root" %}
We are intentionally installing the package at the root of the workspace because this forces the organization to have the upfront cost of agreeing on the same versions of dependencies rather than the delayed cost of having projects using multiple different incompatible versions of dependencies. This is not a requirement of Nx, just a suggestion to help you maintain a growing repo.
{% /callout %}

**Eleventy Hello World**

Create a file at `packages/blog/package.json` with these contents:

```json
{
  "name": "blog",
  "description": "eleventy blog",
  "version": "1.0.0",
  "scripts": {
    "build": "eleventy --input=./src --output=../../dist/packages/blog",
    "serve": "eleventy --serve --input=./src --output=../../dist/packages/blog"
  }
}
```

These scripts tell Eleventy to read from the `src` folder we'll create next and output to Nx's default location under `dist`.

Next, add `packages/blog/src/index.html`:

```html
<p>Hello, Eleventy</p>
```

## Clean Up

If you have a `workspace.json` file in the root, delete it.

## Running Eleventy with Nx

Now that we have the bare minimum set up for Eleventy, you can run:

```shell
nx serve blog
```

And you can see `Hello, Eleventy` at `http://localhost:8080`.

Also, if you run:

```shell
nx build blog
```

The build output will be created under `dist/packages/blog`. So far, Nx isn't doing anything special. If you run `nx build blog` again, though, you'll see it finish in less than 100 ms (instead of 1s). The caching doesn't matter yet, but as build times grow, it will become far more useful.

The main value of Nx at this stage of the project is that it doesn't require any custom configuration on your project. The blog could have been built with any of a dozen different platforms and Nx would cache the output just the same.

## Build a Basic Blog

To actually create a blog, we'll have to change a few more files. This is all Eleventy specific configuration, so if you have questions consult [their documentation](https://www.11ty.dev/docs/config/) or [this tutorial](https://www.filamentgroup.com/lab/build-a-blog/).

Update `index.html`:

```html {% process=false %}
---
layout: layout.liquid
pageTitle: Welcome to my blog
---

{% for post in collections.posts %}
<h2><a href="{{ post.url }}">{{ post.data.pageTitle }}</a></h2>
<em>{{ post.date | date: "%Y-%m-%d" }}</em>
{% endfor %}
```

Create the following files:

`packages/blog/src/_includes/layout.liquid`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>My Blog</title>
  </head>
  <body>
    <h1>{{ pageTitle }}</h1>

    {{ content }}
  </body>
</html>
```

`packages/blog/src/posts/ascii.md`:

```markdown
---
pageTitle: Some ASCII Art
---

Welcome to [The Restaurant at the End of the Universe](https://hitchhikers.fandom.com/wiki/Ameglian_Major_Cow)

<pre>
 _____
< moo >
 -----
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
</pre>

Art courtesy of [cowsay](https://www.npmjs.com/package/cowsay).
```

`packages/blog/src/posts/posts.json`:

```json
{
  "layout": "layout.liquid",
  "tags": ["posts"]
}
```

Once these files are in place, run `nx serve blog` again. Navigate to `http://localhost:8080/posts/ascii/` in a browser and you should see the blog post.

## What's Next

- Continue to [Step 2: Create cli](/core-tutorial/02-create-cli)
