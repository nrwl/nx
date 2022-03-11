# Core Nx Tutorial - Step 1: Create Eleventy Blog

In this tutorial you create multiple projects in a monorepo and take advantage of the core Nx features with a minimum of configuration.

## Create a New Workspace

**Start by creating a new workspace.**

```bash
npx create-nx-workspace@latest
```

You then receive the following prompts in your command line:

```bash
Workspace name (e.g., org name)         myorg
What to create in the new workspace     core
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

```bash
yarn add -D -W @11ty/eleventy@1.0.0
```

or

```bash
npm add -D @11ty/eleventy@1.0.0
```

Note: We are intentionally installing the package at the root of the workspace because this forces the organization to have the upfront cost of agreeing on the same versions of dependencies rather than the delayed cost of having projects using multiple different incompatible versions of dependencies. Yarn needs the `-W` flag so that you can install dependencies at the root. This is not a requirement of Nx, just a suggestion to help you maintain a growing repo.

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

## Running Eleventy with Nx

Now that we have the bare minimum set up for Eleventy, you can run:

```bash
nx serve blog
```

And you can see `Hello, Eleventy` at `http://localhost:8080`.

Also, if you run:

```bash
nx build blog
```

The build output will be created under `dist/packages/blog`. So far, Nx isn't doing anything special. If you run `nx build blog` again, though, you'll see it finish in less than 100 ms (instead of 1s). The caching doesn't matter yet, but as build times grow, it will become far more useful.

The main value of Nx at this stage of the project is that it doesn't require any custom configuration on your project. The blog could have been built with any of a dozen different platforms and Nx would cache the output just the same.

## Build a Basic Blog

To actually create a blog, we'll have to change a few more files. This is all Eleventy specific configuration, so if you have questions consult [their documentation](https://www.11ty.dev/docs/config/) or [this tutorial](https://www.filamentgroup.com/lab/build-a-blog/).

Update `index.html`:

```html
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
