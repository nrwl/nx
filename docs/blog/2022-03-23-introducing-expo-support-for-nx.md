---
title: 'Introducing Expo Support for Nx'
slug: 'introducing-expo-support-for-nx'
authors: ['Emily Xiong']
cover_image: '/blog/images/2022-03-23/1*yYc8g4ifk9RApSjAhQysag.png'
tags: [nx, release]
---

We are very excited to announce our support for Expo with our new package `@nrwl/expo`. In addition to the React Native support, with this release of `@nrwl/expo`, you will be able to easily develop mobile apps in the monorepo. If you use Expo in a monorepo then Nx is the tool for you.

This blog will show you how to create a one-page app to display a poem:

![[object HTMLElement]](/blog/images/2022-03-23/1*vDAGnOKsuXDhMDDtw7Swcg.avif)
_Page Screenshot (left: Android, right: iOS)_

Github Repo:

[

### GitHub - xiongemi/nx-expo-poetry

### This project was generated using Nx. 🔎 Smart, Fast and Extensible Build System Nx supports many plugins which add…

github.com

](https://github.com/xiongemi/nx-expo-poetry?source=post_page-----3fffb1849a6f--------------------------------)

GitHub Page: [https://xiongemi.github.io/nx-expo-poetry/](https://xiongemi.github.io/nx-expo-poetry/)

## Before We Start

When I just started to try out Expo, the first questions came to my mind were “what is the difference between Expo and React Native” and “when to choose Expo and when to choose React Native”? In short, Expo is a set of tools built on top of React Native. You can read it more at [https://stackoverflow.com/questions/39170622/what-is-the-difference-between-expo-and-react-native](https://stackoverflow.com/questions/39170622/what-is-the-difference-between-expo-and-react-native).
