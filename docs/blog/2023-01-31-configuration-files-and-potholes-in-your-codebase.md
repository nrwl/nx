---
title: 'Configuration Files and Potholes in Your Codebase'
slug: 'configuration-files-and-potholes-in-your-codebase'
authors: ['Isaac Mann']
cover_image: '/blog/images/2023-01-31/0*T-xiDccBOxMQpDrG.png'
tags: [nx]
---

Let’s talk about configuration. The detractors call it boilerplate while proponents call it scaffolding or infrastructure. No matter what your feelings are, configuration code is all the setup that needs to be done before you can work on the features that actually accomplish something for your business. Like road maintenance, infrastructure code is often unnoticed when it is done well, but as soon as problems crop up, everyone feels the pain. How can this crucial configuration code be effectively maintained without dragging down the productivity of your development team?

## Less Configuration

There have been many attempts over the years to make it easier to bypass configuration code.

![](/blog/images/2023-01-31/0*RHP5AYxe6DD7UaYx.avif)

Ruby on Rails popularized the philosophy of Convention over Configuration. In this philosophy, the default configuration settings are derived from your folder structure or the way you name your files. These unwritten conventions are used as a way of bypassing writing configuration files that most of the time will follow a set pattern.

![](/blog/images/2023-01-31/0*y-gFItbtvrFYx9_3.avif)

Parcel advertises itself as a zero configuration bundler. This is mostly a reaction to webpack, which requires a fairly complex config file before it can do anything useful. As application grow more complex, so does the config file. These often become so complicated that developers dread fixing any problems with them, because once it becomes known that they have fixed a problem with webpack, they will be forever saddled with the burden of maintaining that file. In contrast, Parcel does all the tasks required of a typical SPA web app without any config file.

![](/blog/images/2023-01-31/0*-sWVhhyftTBiuMef.avif)

Apple also leveraged this sentiment with marketing slogan “It Just Works”. Compared to Windows or Linux ecosystems that require modifying settings to get software from different companies to work together, Apple provides its own suite of tools and hardware that have a major selling point of being intentionally designed to all work together. Theoretically, any hardware or software produced by Apple should fit seamlessly into the rest of the system.

All of these efforts to skip the configuration step reach their limits at some point. The idea of hiding default configuration works well, until you need to modify that default and have no starting point. The Zen of Python philosophy of “explicit is better than implicit” is a direct contradiction to Convention over Configuration. If you like most of what the zero config tool gives you, but you want to tweak it a little bit, it can be hard to find where to do the tweaking. Apple is great when It Just Works. But sometimes, It Just Doesn’t.

![](/blog/images/2023-01-31/0*8f5YjBkc6SqPBA5E.avif)

## How much configuration is the right amount of configuration?

When your application is just getting started or when the configuration defaults work just fine for you, any time spent writing those defaults is wasted time and mental space. This applies to default configuration for initializing a project as well as default configuration for adding a new route or component in your application. When a developer is starting a new project or feature, we want their initial burst of energy to go as much as possible toward code that is valuable for the business, rather than code that is just infrastructure.

On the other hand, when the infrastructure code needs to be modified to make your application faster or modify the way the app behaves in some way, that infrastructure code needs to be easily accessible and clearly organized so that developers don’t need to understand everything about the system before they can change a single part.

## Skip the Scaffolding

A cursory glance at the repos on Github will reveal numerous starter repos that people use to bypass the initial time investment involved in setting up the initial configuration files. Yeoman was a tool used to help generate scaffolding code, both for starting a project and for creating new sections of an application.

The problem with both of these tools is that any code they generate for you is instantly technical debt. By definition, no one in your company wrote the code that was created by those tools. But developers in your company will now have to maintain this code that they didn’t write. Even if the starter project or Yeoman generator was well maintained and always used the latest state of art practices, any application built using them will only be state of the art the instant its created. The infrastructure code grows stale without constant maintenance.

## Nx Generators and Migration Generators

![](/blog/images/2023-01-31/1*p-fVnh5Cwp1rTZPhehl14g.avif)

Nx has an elegant solution to this dilemma. There are three key parts.

1.  Use [code generators](/features/generate-code) to create configuration files that you can safely ignore
2.  Modify those configuration files whenever your application needs some custom setting
3.  Run [migration generators](/features/automate-updating-dependencies) to maintain state of the art defaults

If you never think about a configuration file is it still technical debt? Some people are put off by the number of configuration files that Nx generates when creating a new application. Perhaps these developers have been burned by starter repos burdening them with instant technical debt that must be maintained. These config files are created only for the eventuality that some day you’ll need to modify them.

When you do need to modify a setting for Webpack, Vite or Jest (or any of the other tools for which we maintain plugins) the configuration file provides you an easy access point to make your own modifications without needing to understand all the default settings.

Every Nx plugin provides migration generators that will automatically update the default settings to the latest state of the art. With these generators, Nx can take on the burden of maintaining your infrastructure code, except for the specific portions that your developers have customized.

## One Size Never Fits All

While the generators that Nx provides work for most people, there will always be infrastructure that is unique to your own organization. Nx makes it easy to extend generators so that your developers can use generators that create code that has been tailored to your own organization’s set up. Instead of having a manual check list to run through every time a developer makes a new feature, you can automate that check list with a generator.

## Negative Configuration?

Nx provides the ability to define default configuration settings at the global level and have individual projects inherit those settings from the global defaults. If a lot of your projects have the same settings, adding Nx to your repo will actually reduce the lines of code in your codebase — thus negative configuration. This isn’t convention over configuration or zero configuration, because the configuration settings are still explicitly defined. The configuration code is just better organized and defined in a predictable way.

If you’re ready to have Nx help you manage your infrastructure so that your developers can speed down the highway without needing to avoid configuration potholes, check out [nx.dev](/getting-started/intro) to get started.

## Learn more

- [🧠 Nx Docs](/getting-started/intro)
- [👩‍💻 Nx GitHub](https://github.com/nrwl/nx)
- [💬 Nx Official Discord Server](https://go.nx.dev/community)
- [📹 Nrwl Youtube Channel](https://www.youtube.com/@nxdevtools)
