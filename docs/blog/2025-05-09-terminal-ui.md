---
title: 'A New UI For The Humble Terminal'
slug: nx-21-terminal-ui
authors: ['Mike Hartington']
tags: ['nx']
cover_image: /blog/images/2025-05-09/terminal-ui.avif
description: 'Nx 21 introduces the new Terminal UI, an elegant way of viewing log output from multiple running tasks.'
youtubeUrl: https://youtu.be/ykaMAh83fPM
---

{% callout type="deepdive" title="Nx 21 Launch Week" expanded=true %}

This article is part of the Nx 21 Launch Week series:

- [Nx 21 Release: Continuous tasks and Terminal UI lead the way](/blog/nx-21-release)
- [Introducing Migrate UI in Nx Console](/blog/migrate-ui)
- [New and Improved Module Federation Experience](/blog/improved-module-federation)
- [Continuous tasks are a huge DX improvement](/blog/nx-21-continuous-tasks)
- **A New UI For The Humble Terminal**

{% /callout %}

At Nx, we're all about providing great experiences. From project inference, to our MCP server, to the great Nx Console extension for VS Code and IntelliJ, we work hard to make sure that developers have a smooth experience when working on their projects. However, there has been one place where you probably got the least great experience compared to the rest: the terminal.

"Um, it's a terminal, it doesn't need much. Why spend time trying to improve it?"

Great question! Why spend time on a terminal? Well, the terminal is the starting point that every developer begins with, and it's ripe for improvements. Plus, with the migration to Rust for Nx core, we took this chance to reevaluate how developers experience the terminal. With a new suite of Rust-based packages at our disposal, we're thrilled to share our brand new terminal UI (or TUI) for Nx 21. Let's dive in!

{% toc /%}

## The Status Quo

Let's first look at how the terminal behaves in Nx 20 and below. In a project with multiple packages, if you run `nx run-many`, what you'll first notice is that you get all the output from any continuous tasks mixed together in one giant stream. This is very typical in most terminal programs, but with monorepos it's not ideal. For instance, let's say we have a build error in one of our projects:

{% video-player src="/documentation/blog/media/2025-05-07/old-tui.mp4" alt="Showing the previous terminal experience for Nx" autoPlay=true loop=true  /%}

It might be hard to notice that we had the error if we have multiple tasks being run, so unless we scroll up, we could miss it. This might sound trivial, but it's an annoyance that doesn't have to happen. It's also difficult to separate tasks that are continuous and those that have an ending.

## Rust To The Rescue

With the Rust migration, we've been looking at the Rust ecosystem and noticed how many terminal-based programs seem to provide a great TUI. For example, if we wanted a resource monitor that was written in Rust, there is `btop`, and it looks awesome:

![Screenshot showing the resource monitor btop](/blog/images/2025-05-09/btop.avif)

This led us to the Rust package [`ratatui`](https://ratatui.rs/), a Rust library for building TUIs. Ratatui provides common building blocks and hooks for working with terminal programs. With Ratatui, we went ahead and rebuilt our TUI with the following goals:

- Provide a great looking UI
- Provide clear output for all tasks
- Provide a way to interact with multiple running processes

So let's see what we've built:

![Screenshot of the Terminal UI for Nx](/blog/images/2025-05-09/tui.avif)

There are a few things going on here, so let's walk you through it.

## A Clear Overview Of Projects

One of the things you may notice is that instead of a stream of output, you're presented with a clear list of all project tasks being run for the given session. You can scroll through the list of tasks with the arrow keys or `h`/`j` if you're used to vim-based navigation.

To inspect a task and its output, you can press `Space` to open a new window with all of the output from that given task. If that output has a lot of content and you'd like to see something further up, you can hit `Tab` and then use the arrow keys to scroll up and down in the output.

![Screenshot of Nx Terminal UI showing how multiple running tasks appear in the sidebar](/blog/images/2025-05-09/multiple-tasks.avif)

If you have a lot of projects being run, and you'd like to filter the list of tasks, you can press `/` and type the project you're looking for.

![Screenshot of Nx Terminal UI showing how filters reduce the number of tasks visible](/blog/images/2025-05-09/filter.avif)

And finally, if there's a particular project that you'd like to constantly see the output for, you can pin the output by pressing `1` or `2`.

![Screenshot of Nx Terminal UI showing how pinning tabs results in their logs being visible](/blog/images/2025-05-09/pins.avif)

Now there are more key bindings in this new TUI, and to see them all, you can use the `?` key.

![Screenshot of Nx Terminal UI's help screen](/blog/images/2025-05-09/help.avif)

## Parting Thoughts

Now, while the new TUI is awesome, it currently is not available on Windows due to various issues with pseudo-terminals. While not ideal, we hope to resolve these issues as soon as possible, so keep an eye out! For macOS and Linux, you can upgrade to Nx 21 today to take advantage of the new TUI:

```shell
nx migrate latest
nx migrate --run-migrations
```

Learn more:

- 🧠 [Nx AI Docs](/features/enhance-AI)
- 🌩️ [Nx Cloud](/nx-cloud)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
