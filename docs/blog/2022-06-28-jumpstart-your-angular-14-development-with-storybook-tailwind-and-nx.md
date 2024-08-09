---
title: 'Jumpstart your Angular 14 development with Storybook, Tailwind and Nx'
slug: 'jumpstart-your-angular-14-development-with-storybook-tailwind-and-nx'
authors: ['Colum Ferry']
cover_image: '/blog/images/2022-06-28/1*AqGzDU7J__u99mwZbcO8GA.png'
tags: [nx, release]
---

With Angular 14 having just been released recently, let us discuss how you can take advantage of some of the most popular tools in the JavaScript ecosystem to increase your efficiency and productivity when building Angular applications.

In this article, we will set up an Nx workspace that is preconfigured for [Angular](https://angular.io/) development and integrates [Storybook](https://storybook.js.org/) and [Tailwind](https://tailwindcss.com/) using generators provided by [Nx](https://nx.dev/). We will then build a simple Button component using only Storybook and Tailwind.

## Workspace Setup

First, let’s start by creating a new Nx Workspace that contains the official Angular plugin. It’s as simple as running a single command:

`npx create-nx-workspace@latest demo --preset=angular`

We will then be prompted to answer questions about what we’re creating.  
Give the application a name of `myapp` and then select the default answers for the rest of the prompts.

This will create our workspace and install the dependencies required to build Angular applications! Ensure you’re at the root of the new workspace by running `cd demo`.

We want to build a component that will be shared among many applications, so let’s create a Shared Components library to store…
