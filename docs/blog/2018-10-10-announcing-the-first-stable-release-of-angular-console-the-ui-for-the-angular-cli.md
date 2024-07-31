---
title: 'Announcing the First Stable Release of Angular Console — The UI for the Angular CLI'
slug: 'announcing-the-first-stable-release-of-angular-console-the-ui-for-the-angular-cli'
authors: ['Victor Savkin']
cover_image: '/blog/images/2018-10-10/1*M6a-RLNqxo_DftgfDHZHJQ.png'
tags: [nx, release]
---

_Victor Savkin is a co-founder of_ [_nrwl.io_](https://goo.gl/v4nh0p)_, providing Angular consulting to enterprise teams. He was previously on the Angular core team at Google._

![](/blog/images/2018-10-10/1*TigvMknUeSYC2BWKvnDCTw.avif)

Angular CLI changed how we build apps. We no longer have to spend time maintaining our webpack configurations, figuring out how to make tests run, fixing source maps — the CLI does this for us. It also helps us enforce consistent development practices by generating components, services, and state management modules.

Since the CLI does so much, it can be intimidating and hard to learn. Most developers only use a fraction of the CLI’s capabilities. **This is what Angular Console is here to address. It helps folks unlock the full power of the CLI. Angular Console is the UI for Angular CLI.**

Before you read any further, watch this video that Jeff Delaney put together after we released the initial version of Angular Console:

We have been working on Angular Console non-stop after the initial release fixing bugs, making it faster, adding missing functionality. And today we are happy to announce the first stable release of Angular Console — Angular Console 6.0.0 (similar to Nx, NgRx, and Material will follow the Angular versioning).

## Who is it for

We have gotten a lot of positive feedback from folks using Angular Console. Developers on Mac and Windows, experts and beginners, developers with mainly backend experience, and those who write polyfills in their spare time, folks who are terminal shy, and those who develop using ed. Everyone agreed that it helps them be more productive with Angular CLI.

### Beginner Friendly

We aim to make Angular Console a great tool for developers who are new to Angular or Angular CLI. If you get a new laptop and install Angular Console on it, you can build a full stack application with a Angular frontend without having to install anything else. Don’t have Node installed? Angular Console will help you set it up.

![](/blog/images/2018-10-10/0*bebe3l7bbN7ghMNV.avif)

You can create projects, interact with your editor, run generators and commands, install extensions without ever touching the terminal or having to install any node packages globally. Also, Angular Console highlights the properties you are likely to use for build-in generators and commands. So if you haven’t used the CLI, you don’t get overwhelmed.

![](/blog/images/2018-10-10/0*U_p_pZ7tzoBuyaED.avif)

### Useful to Experts

At the same time, Angular Console is a robust tool that can do everything the Angular CLI can do — it’s the UI for the CLI. Every command you can run in the terminal, you can run via Angular Console. Except you no longer have to remember all the flags, names, or paths — Angular Console will help you by providing autocompletion and validating your inputs.

![](/blog/images/2018-10-10/0*23i1n57FN5nmKMJ9.avif)

We at Nrwl hire the best Angular developers, and most of us find Angular Console a great companion to the CLI and use it on the daily basis.

## How is it different from other tools?

Other CLI tools in the Javascript ecosystem are optimized around a few built-in commands. Essentially, all of them have a switch statement somewhere saying “if running ‘build’, show this”. That’s not how Angular Console works. Anything that can run in the terminal, can run in Angular Console. For instance, when Nx added support for building and running node applications, you could use those generators and commands in Angular Console right away — no changes to the tool were required.

Teams building large real-world applications have to extend the CLI by adding new commands and generators to meet their applications’ needs. Angular Console will handle those the same way it handles the built-in serve or test. In other words, Angular Console does not just work for demos and toy projects — it’s great tool for any Angular application.

## Works on All Platforms!

When we started working on this product it kept having subtle bugs on Windows. Not that surprising given that we all used Mac or Linux. One day, after dealing with one of those bugs, I decided that’s enough. I went to the closest Microsoft shop and got myself a Surface Book. I switched to using Windows full time that day (and I actually enjoy it now) to make sure Console works well on Windows. After that, the number of Windows-related issues dropped. **Now I’m proud to say that Angular Console works well on all major platforms: Windows, Mac, and Linux.**

**Also, similar to WebStorm and VS Code, it autoupdates. So you will automatically get new functionality and bug fixes with every release.**

## A Community Project

**Angular Console is free and open source.** Even though the core of the project is built by folks at Nrwl, we have been receiving a great deal of external contributions. Special thanks to Kamil Kisiela, from the Angular Apollo team, who helped us make our GraphQL APIs robust.

We are also excited to announce that Wassim Chegham, the author of Angular Klingon, has just joined the core team of Angular Console.

Finally, we want to say special thanks to Stephen Fluin, Matias Niemelä, and Alex Eagle from the Angular team at Google. They have been working with us in the last couple of months.

We are very excited to see the relationship with the Angular team grow. We are in the process of transferring the responsibility of building and publishing Angular Console binaries to the Angular team. This will give the community the confidence that Console is here to stay, and that is is a tool every developer should have in their toolbelt alongside Angular CLI.

## Talk to Us at AngularMix

Jeff Cross and I \[Victor Savkin\] are giving two talks about about Angular Console at [Angular Mix](https://angularmix.com/#!/schedule). Find us at the conference, talk to us about console.

## Learn More

- [angularconsole.com](http://angularconsole.com/) — the official site of the project
- [Watch Angular Console 5-minute overview video by Angular Firebase folks](https://www.youtube.com/watch?time_continue=18&v=d2K2Cp8BJx0)
- [Angular CLI course by John Papa](https://www.pluralsight.com/courses/angular-cli) — the Angular CLI course by John Papa has a video on Angular Console
- Watch [this episode of Angular Air](https://www.youtube.com/watch?v=rzQzrkKYS0c) about Angular Console.

## Try it out!

Try it out at [angularconsole.com](https://angularconsole.com/)

![](/blog/images/2018-10-10/1*TigvMknUeSYC2BWKvnDCTw.avif)

### Victor Savkin is a co-founder of Nrwl. We help companies develop like Google since 2016. We provide consulting, engineering and tools.

![](/blog/images/2018-10-10/0*NSLFXiKLN4PAjCOW.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
