---
title: 'Brand New UI, Custom VSCode Task Support + More in Angular Console 9.0!'
slug: 'brand-new-ui-custom-vscode-task-support-more-in-angular-console-9-0'
authors: ['Daniel Muller']
cover_image: '/blog/images/2019-11-08/1*iCu-DaUaRn9txX9vhY1UJQ.png'
tags: [nx, release]
---

Today I am happy to announce some new improvements for [Angular Console](http://Angularconsole.com), a tool that the team at [Nrwl](http://Nrwl.io) hopes will be useful for every Angular developer.

In this post, I’ll be going over all the new features of our new release for Angular Console on Visual Studio Code. I’ll also inform you about Angular Console’s future.

Let’s start with the new release.

## A New User Interface

In this release we have completely re-written our user interface from the ground up to feel more more native to the editor in which it lives. When we first ported Angular Console to **Visual Studio Code**, we more or less just took our existing electron app and repackaged it inside of an webview in the editor. Over time we’ve gotten a bunch of feedback from the community that this approach **didn’t feel right**. The issue’s our users pointed out can be categorized as follows:

- The UI feels out of place and doesn’t match the things around it
- The UI hurts my eyes since it does not change with my editor’s theme
- The UI takes too long to boot up and feels slow and clunky as a result
- The UX is not ergonomic enough and can use some general usability improvements

Based on this feedback, we decided to try to create something radically different than our initial release. Something that uses the editor’s built in components and design concepts so that it **feels right**.

![[object HTMLElement]](/blog/images/2019-11-08/1*GIHiPoIyVTCI35wpYRgWog.avif)
_OMG, console looks so good. Did she get a haircut?_

Using VSCode’s native settings UI as a UX reference, we created a new form that can be used to execute Angular CLI commands and generate code using CLI schematics. **Its main features are:**

- Launches faster
- Uses less CPU resources
- A sidebar of all flags you can edit for a particular CLI command
- A filter bar for quickly finding a particular flag
- Theming support
- Command palette support (you can launch the UI by typing `ng ui`)

## Driving the Angular CLI using only your Keyboard

Where user interfaces are great for exploring unfamiliar commands and tweaking the fields of a particular schematic until you get it just right, often during development we find our selves doing **quick repetitive tasks** that are part of a workflow we come up with when implementing a particular feature.

As an example, I usually will run `ng test my-project` every so often when I am trying to fix a particular bug to see if I’ve fixed it or not. In this example, here is the new UX flow we’ve built into console:

1.  Open the [VSCode command palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette).
2.  Select `ng: test`.
3.  Select `my-project` from list of Angular CLI projects presented to you.
4.  Type in any additional flags for `ng test`. In our example we don’t have any in mind so we just hit enter again.
5.  Watch as and see if the test passes.
6.  Make a change to your code, if the test doesn’t pass.
7.  Open the command palette and select `Rerun last task` to test it again.
8.  Repeat 7 and 8 until it’s finished.

![](/blog/images/2019-11-08/1*BrwJVeN-AcZFXTsmLHJzkA.avif)

## Custom VSCode Task Support

Larger teams share common tasks that apply to their particular workspace or vertical they work on. For the clients I’ve serviced in the past this usually involves a set of commands which orchestrate kicking off a dev-server. VSCode has introduced a means of integrating these tasks directly into the editor using `.vscode/tasks.json` ([docs can be seen here](https://code.visualstudio.com/docs/editor/tasks#_custom-tasks)). Declaring tasks in this way allows you to integrate directly into VSCode’s debugger.

With this new release of Angular Console, you can now register Angular CLI with VSCode. An Angular Console command has the type of `ng` and requires that you specify an Angular CLI `command` and a `project` in your workspace (`serve` and `super-awesome-app` in our example). Optionally, you can specify an array of `flags` to pass to the CLI to tweak your command.

As an example, let’s say that my team, the `Super-Narwhals` have a development server which requires that we first run some NPM script which bootstraps our workspace. You can now declare that orchestration via:

> > > GO GET VIDEO FROM https://blog.nrwl.io/brand-new-ui-custom-vscode-task-support-more-in-angular-console-9-0-5e4d3a109fb9![](/blog/images/2019-11-08/1*Q6cF3TpODdQSPjkAnGsSig.avif)

## Remote Shell Support (aka WSL / SSH support)

Angular Console now uses VSCode’s native tasks API to invoke the CLI. With this new architecture you can a launch a [remote VSCode host](https://code.visualstudio.com/docs/remote/remote-overview) and Angular Console will work out-of-the-box. Tasks you launch with Angular Console will run on your remote machine without having to customize anything.

## The Future of Angular Console

### The end of our electron app

It is with a sad heart that I inform you that we’re no longer supporting our electron release of Angular Console. We have such a small team and this has made supporting both VSCode and Electron a strain on our resources, which led to releases below our desired quality (on both platforms). Ultimately, the VSCode extension has the benefit of getting to leverage VSCode’s existing infrastructure so we’ve made the decision to focus our energy on the extension. This seems like the right decision, rather than trying to bake the same feature’s into our electron application.

It turns out that writing a good integrated terminal is difficult. Much more difficult than could be supported by three developers devoting one day a week to supporting all the edge cases that come up on different platforms. The VSCode team has done a fantastic job of tackling edge cases associated with doing so. We are pleased to use the editor’s native APIs to run the Angular CLI inside their terminal, rather than rolling ours in our electron application.

### Angular Console VSCode

Over the coming months we plan to add a number of exciting new features to our extension. Here are a couple of them, just to wet your whistle:

- Keyboard-driven UX will improve significantly over time. Rather than utilizing a text input for additional flags as we’ve done in this release, we plan to read the schema associated with a particular Angular CLI command and implement autocomplete support for setting additional flags.
- Creating new workspaces with the CLI. We plan to include a number of useful templates to help make getting started with the CLI for a particular use-case fast and easy.
- NX command support. We will integrate all commands associated with Nrwl’s NX CLI into the extension over time to give first class editor support for our monorepo users out there.

Thanks for reading! That’s all folks!

![](/blog/images/2019-11-08/0*WL5InnWDnAuqfbfZ.avif)

As always, if you are looking for enterprise consulting, training and support, you can find out more about how we at Nrwl work with our clients [here](https://nrwl.io/services/consulting).

![](/blog/images/2019-11-08/0*sUuN-NoTZiZ4cg22.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [Daniel Muller](https://blog.nrwl.io/@mrmeku) _and_ [_@nrwl_io_](https://medium.com/@nrwl_io) _to read more about Nx and Nrwl._

_Check out Nrwl’s extensible dev tools for monorepos: Nx!_

![](/blog/images/2019-11-08/1*pbElIZt9YeORNw8m142z6w.avif)
