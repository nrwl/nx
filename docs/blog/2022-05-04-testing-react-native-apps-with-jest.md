---
title: 'Testing React Native apps with Jest'
slug: 'testing-react-native-apps-with-jest'
authors: ['Emily Xiong']
cover_image: '/blog/images/2022-05-04/1*OXnODpoFXaimLz-m0bDu4g.png'
tags: [nx, release]
---

### How to write unit and e2e tests for React Native apps using Jest in an Nx workspace

In my previous [blog](https://medium.com/share-code-between-react-web-react-native-mobile-with-nx-fe5e22b5a755), I finally finished writing my awesome Nx React Native App. The app is running fine. Can I just commit my changes and call it a wrap?

No. As a disciplined developer, I know that finishing writing application code is only a job half done; the other half is writing tests.

This blog will go through:

- How to write unit tests for React Native components
- How to write e2e tests

Example Repo:

[

### GitHub - xiongemi/studio-ghibli-search-engine: A search engine to search films and characters under…

### This project was generated using Nx. 🔎 Smart, Extensible Build Framework This app is a search engine for Studio…

github.com

](https://github.com/xiongemi/studio-ghibli-search-engine?source=post_page-----17b322b87b4c--------------------------------)

## Unit Testing with Nx React Native

To run unit tests, simply run:

```
nx test **<your app or lib>**
```

If you’re using Visual Studio Code, you can use [Nx Console](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console) to run the test command:
