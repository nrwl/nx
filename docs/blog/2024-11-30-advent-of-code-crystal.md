---
title: Advent of Code Gets The Crystal Treatment!
slug: advent-of-code-crystal-edition
authors: ['Zack DeRose']
tags: [nx]
cover_image: /blog/images/2024-11-30/thumbnail.avif
youtubeUrl: https://youtu.be/st6Yq-19bW8
description: Get started with Advent of Code using our Nx-powered starter repo that handles all setup, letting you focus purely on solving the daily challenges.
---

Talking with developers, we've found that one of the main reasons folks like using Nx is: Nx allows their team to focus on shipping a great product, while Nx handles all the rest:

- setting up tools for testing, linting, and etc.
- dynamic CI/CD pipelines with Nx Cloud
- a code generation framework to manage expanding their projects

For the past couple years, we've been releasing an `Advent of Code Starter Repo` with this in mind!

If you're not familiar, [Advent of Code](https://adventofcode.com/) is a special event that runs every December that works like a Advent Calendar of programming problems. Every day at midnight, we all get access to 2 new puzzles that will award us a gold star if you can complete it successfully.

Specifically, our goal is to give developers an easy to use starting point that allows them to focus on solving the puzzles, and handing the rest over to Nx instead of wrestling with setting up tools, file i/o, and the like.

This year, we were able to further reduce the nx-specific config needed, using the new [Nx Project Crystal](/concepts/inferred-tasks) enhancements that landed earlier this year!

## Packages Landed!

We're excited to announce version `2.0.0` of the [`create-ts-aoc-starter`](https://www.npmjs.com/package/create-ts-aoc-starter) and [`ts-aoc-starter`](https://www.npmjs.com/package/ts-aoc-starter) packages are released, just in time for Advent of Code 2024!

### [`create-ts-aoc-starter`](https://www.npmjs.com/package/create-ts-aoc-starter)

This is the code generation command to setup your Advent of Code workspace! Simply run the command:

```terminal
> npx create-ts-aoc-starter@latest
```

And we'll spin up your workspace for you, all tools configured and ready to go!

### [`ts-aoc-starter`](https://www.npmjs.com/package/ts-aoc-starter)

This is the Nx Plugin we're shipping this year that comes pre-installed whenever you run the `create-ts-aoc-starter` command. By installing this package, and adding the `dynamic-tasks` to your `plugins` array of your `nx.json` file, Nx can setup all the commands we'll need for Advent of Code this year, with no manual setup or config required!

## How It Works

After generating your workspace, you'll find a directory for each of the 25 days of the game, and inside each directory, you'll find the following files:

- `a.data.sample.txt`
- `a.data.txt`
- `a.ts`
- `b.data.sample.txt`
- `b.data.txt`
- `b.ts`

Provide your solution to the first part of the day in the `a.ts`, and you can copy and paste your code into `a.data.txt`.

For _most_ days, the puzzle also comes with a sample set of data to demonstrate what the correct answer would be. On these days, you can enter that data into the `a.data.sample.txt` file provided!

To run your solution against the sample data for day 1 then, run one of the commands:

```terminal
> nx day-1-a-sample
> nx day-1-sample
> nx 1-a-sample
> nx 1-sample
```

And to run against the actual data, you can run one of the following:

```terminal
> nx day-1-a
> nx day-1
> nx 1-a
> nx 1
```

Sometimes the second part of the problem simply builds on top of the first. On those days, you can just continue to code in the `a.ts` file, but a `b.ts` and `data.txt` files are also provided if you want to start over. To run these, use the commands:

```terminal
> nx day-1-b
> nx 1-b
> nx day-1-b-sample
> nx 1-b-sample
```

### New Feature for 2.0.0: File Watching!

We've also added file watching (using [`nx watch`](/nx-api/nx/documents/watch) behind the scenes!)

Simply add `watch-` to the start of any of the commands and aliases listed above to start any of them in watch mode, so they automatically re-run as soon as any changes to the file system are detected! Example:

```terminal
> nx watch-1
```

### New Feature for 2.0.0: Additional Data Sets!

This year, we're also including the ability to drop in additional data sets. This can be particularly helpful in later days (as the problems get harder) and you want to test your solution on a data set that isn't the specific sample or the actual dataset provided. For this, simply create a `data.txt` file matching the naming pattern.

For example, if I wanted to create a data set called `foo`, I'd create in the filesystem a file called `a.data.foo.txt`. Then to run against this data set, run one of the commands:

```terminal
> nx day-1-a-foo
> nx day-1-foo
> nx 1-a-foo
> nx 1-foo
> nx watch-day-1-a-foo
> nx watch-day-1-foo
> nx watch-1-a-foo
> nx watch-1-foo
```

## Learn more

- [Tutorial: Creating Your Own Plugin With Inferred Tasks](/extending-nx/tutorials/tooling-plugin#create-an-inferred-task)
- [Nx Docs](/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools)
- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
