---
title: 'Use Storybook with Nx React Native'
slug: 'use-storybook-with-nx-react-native'
authors: ['Emily Xiong']
cover_image: '/blog/images/2022-04-25/1*64nWVfUBihlYTLGWOvnc1g.png'
tags: [nx, release]
---

### How to add Storybook to Nx React Native applications

In my previous [blogs](https://emilyxiong.medium.com/share-code-between-react-web-react-native-mobile-with-nx-fe5e22b5a755) _(see links at the end)_, I wrote about how to develop Nx React Native applications. However, as developers, we are constantly searching for ways to make the developer experience better.

This blog will show how to add Storybook to Nx React Native applications. With Nx, you don’t need to go through [this long guideline](https://storybook.js.org/tutorials/intro-to-storybook/react-native/en/get-started/) to set up the Storybook, you can quickly get it running.

Example Repo:

[

### GitHub - xiongemi/studio-ghibli-search-engine: A search engine to search films and characters under…

### This project was generated using Nx. 🔎 Smart, Extensible Build Framework This app is a search engine for Studio…

github.com

](https://github.com/xiongemi/studio-ghibli-search-engine?source=post_page-----2ddd8c010eda--------------------------------)

Storybook:

![[object HTMLElement]](/blog/images/2022-04-25/1*bDKKjnrt2D6XIBDnWN1z2Q.avif)
_Storybook View (left: Android, right: iOS)_

## Setup

First, you need to add `@nrwl/storybook` to your existing Nx React Native workspace:

```shell
**_\# npm_**
npm install @nrwl/storybook --save-dev**_\# yarn_**
yarn add --dev @nrwl/storybook
```

Then you need to generate the storybook configuration for your app or lib:
