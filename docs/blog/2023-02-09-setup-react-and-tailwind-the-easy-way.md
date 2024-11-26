---
title: 'Setup React and Tailwind — The Easy Way'
slug: 'setup-react-and-tailwind-the-easy-way'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2023-02-09/1*TK4Kdj-cc890gQkgUtKNyA.png'
tags: [nx, tutorial]
---

Developers love to argue about whether Tailwind is good, almost like arguing about code formatting or tabs vs. spaces (I use spaces!!). But whether you love it or hate it, Tailwind has found massive adoption among the frontend developer community. In fact, I’m right now in the process of refreshing and rebuilding my personal site (it will be at [https://juri.dev](https://juri.dev/) soon, so keep an eye on that).

## Prefer a video? I’ve got you covered!

{% youtube src="https://www.youtube.com/watch?v=hHh0xhzSnx8" /%}

## Configuring Tailwind for React

Tailwind has good docs around getting started quickly. There are options to set up Tailwind with their Tailwind CLI, PostCSS, and framework-specific guides.

![](/blog/images/2023-02-09/0*Z6SYFsnv-oA5FHz-.avif)

These steps mostly involve

- installing `tailwindcss`, `postcss` and `autoprefixer`
- configuring your `tailwind.config.js` to make sure Tailwind can properly "purge" its generated CSS file based on the content files (usually your `html`, `[j|t]sx`, `[t|j]s` )
- adjusting your main CSS file to include the Tailwind base classes (in case you want to use Tailwind also in your CSS files, a heated topic)

**One important thing:** if you use [Create-React-App](https://create-react-app.dev/) you might want to check out [what the Tailwind docs say](https://tailwindcss.com/docs/guides/create-react-app) first.

![](/blog/images/2023-02-09/0*tcPmgZM4SjA2QM80.avif)

This came up a couple of weeks ago due to a [PR opened on the CRA repo](https://github.com/reactjs/reactjs.org/pull/5487) asking to kinda deprecate it as the main choice for new React projects. I couldn’t help but share my opinion on this as well:

{% youtube src="https://youtu.be/fkTz6KJxhhE" /%}

And so did also [Fireship](https://youtu.be/2OTq15A5s0Y) and ultimately [Dan Abramov](https://github.com/reactjs/reactjs.org/pull/5487#issuecomment-1409720741). Anyway, if you’re in the **“CRA situation”, read on**. There’s a way to get unblocked there.

## There is an easier way — Code Generators

Code generators speed up such configuration tasks. They are valuable for scaffolding the initial project structure and adding new features to the app setup, such as Tailwind.

Nx has such generators. To use them, you need an Nx-based React setup. If you’re starting new, you can create an [Nx Standalone React project](/getting-started/tutorials/react-standalone-tutorial) easily using the following command

```shell
$ npx create-nx-workspace reactapp --preset=react-standalone
```

![](/blog/images/2023-02-09/0*Zw73l-Hm4PBi1mBD.avif)

As you can see, this allows you to choose which bundler to use as well as other options (such as the CSS setup). Again, this is already such a code generator that creates this initial project scaffold.

Alternatively, **if you happen to use CRA already**, you can easily convert to an Nx and Vite (or also Webpack) based setup by running:

```shell
$ npx nx@latest init
```

You can pass `--vite=false` if you still want to keep the Webpack configuration or pass `--integrated` if you already plan to have a monorepo instead of a single-project setup. The [Nx docs go into more detail here](/recipes/adopting-nx/adding-to-existing-project).

## Generating a Tailwind Setup

Once you have a [Nx-based React](/getting-started/tutorials/react-standalone-tutorial) setup, adding Tailwind is as easy as running:

```shell
$ npx nx g @nrwl/react:setup-tailwind
```

This launches a generator that will guide you through the setup. It works **not only for Nx React-based projects** but **also if you use Next.js** in an Nx workspace.

You’ll get

- Tailwind, PostCSS, and Autoprefixer installed
- Tailwind configured together with PostCSS
- your main `styles.css` file updated with the Tailwind base classes

![](/blog/images/2023-02-09/0*lOVFEvRc7Wrsm5V_.avif)

## That’s it!

You should be all setup and ready now! Here are some related resources to explore:

- [Nx docs: React Standalone tutorial](/getting-started/tutorials/react-standalone-tutorial)
- [Nx docs: React Monorepo tutorial](/getting-started/tutorials/react-monorepo-tutorial)
- [Youtube: Is CRA Dead](https://youtu.be/fkTz6KJxhhE)
- [Nx docs: Migrate CRA to React and Vite](/recipes/adopting-nx/adding-to-existing-project)

## Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- 🥚 [Free Egghead course](https://egghead.io/courses/scale-react-development-with-nx-4038)
