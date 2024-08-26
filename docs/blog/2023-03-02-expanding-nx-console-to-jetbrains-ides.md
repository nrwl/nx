---
title: 'Expanding Nx Console to JetBrains IDEs'
slug: 'expanding-nx-console-to-jetbrains-ides'
authors: ['Max Kless']
cover_image: '/blog/images/2023-03-02/1*lEAhfd3d17hGichyT-oGbw.png'
tags: [nx]
---

**_Co-authored by_** [**_Jon Cammisuli_**](https://twitter.com/jcammisuli)

Nx Console has been on the Visual Studio Code marketplace for years, and with over 1.2 million downloads, we know that a
lot of folks enjoy using it for their day to day Nx related tasks.

That makes it even more **exciting for us to officially announce that Nx Console is now available for JetBrains IDEs**!!
Go grab it on the official store.

👉 **Install link:
** [https://plugins.jetbrains.com/plugin/21060-nx-console](https://plugins.jetbrains.com/plugin/21060-nx-console)

![](/blog/images/2023-03-02/1*gnMRzttFFaoTX0tVw-zZbQ.avif)

Before we go into details of Nx Console for IntelliJ, we’d really want to go and **thank our community**. [\* \*_Issam Guissouma_\*\*](https://twitter.com/iguissouma) and [**_Edward Tkachev_**](https://twitter.com/etkachev) from the
Nx community had their own Nx Console plugins for IntelliJ out there already for a while. And they have been super
popular. As such we’d like to take the occasion to give them a shout-out for the awesome work on the community plugins,
but also for closely collaborating with us over the last weeks to build our official IntelliJ support for Nx Console.

Especially Issam has been actively helping us port over all the features he built to the official Nx Console plugin. So
be sure to look out for the upcoming release because it’s going to be another huge one!

### Table of Contents

· [Going from one IDE to two](#going-from-one-ide-to-two)  
· [Nx Language Server](#nx-language-server)  
· [Generate UI](#generate-ui)  
· [Communicating with IntelliJ](#communicating-with-intellij)  
· [Adapting Styling](#adapting-styling)  
· [JCEF](#jcef)  
· [Glueing it together](#glueing-it-together)  
· [Looking ahead](#looking-ahead)

**Prefer a video version? We’ve got you covered!**

{% youtube src="https://www.youtube.com/watch?v=xUTm6GDqwJM" /%}

## Going from one IDE to two

Nx Console has a ton of features to improve your development experience while working on Nx and Angular repos, some
small and some big.

To provide the most value from the get-go for JetBrains users, we first focused on integrating two main areas: The Nx
Language Server and the Generate UI.

**The Nx Language Server (nxls)** is based on
the [Language Server Protocol (LSP)](https://microsoft.github.io/language-server-protocol/). It serves as a single
source of truth for all information about your workspace and its projects. With it, you get features such a code
completion for `project.json` and `nx.json` files, clickable links for all kinds of files and more. Being a standalone
process, it’s editor-agnostic per default, which is great! However, IntelliJ doesn’t natively support the language
server protocol yet, so we had to write some code that bridges the gap between the two. More about that in the following
section!

The great thing about having a central “brain” for both extensions is that it saves a lot of time writing the same
functionality multiple times. We only have to deal with platform-specific code for rendering UI or defining actions
instead of parsing `nx.json` files and the like. This makes both VSCode and IntelliJ extensions thin, DRY wrappers
around the nxls.

Another major part of Nx Console is the **Generate UI**. Instead of combing through CLI commands to fit your specific
use-case, you can use the form-based view it provides. It’s a separate web application (currently built with Angular)
that runs inside VSCode as a webview. Again, being a standalone application means that we didn’t have to rewrite it
completely in order to integrate it into JetBrains-based editors!

## Nx Language Server

Development of the Nx Language Server (nxls) began as a way to provide autocompletions in Nx specific files. But we came
to the realization that the `nxls` could also provide much more information.

The language server is a separate process that is called by the running IDE (that being VSCode, and now Intellij) that
communicates via json rpc.

With the Language Server Protocol, there are certain methods that are called between the IDE and the language server,
such as
[`textDocument/completion`](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_completion)
that must be implemented.

When the `nxls` does Language Server Protocol related things (like autocomplete), it uses the local workspace copy of Nx
to get information about the workspace. Since this workspace information is already loaded in memory, it presented a
solution to just use that same workspace info in the IDEs without us having to rewrite this logic in multiple
languages (ie, TypeScript and Kotlin).

We found out quickly that we can implement custom requests within the `nxls` to respond to other queries that aren’t
actually part of the Language Server Protocol. These requests are what allows us to use the `nxls` in multiple IDEs and
allow us to quickly iterate.

One of these custom requests is
[`nx/workspace`](https://github.com/nrwl/nx-console/blob/756fdfb545de413436193227d273d078628d7829/libs/language-server/types/src/index.ts#L18-L23).
Calling this endpoint gives us the same information that you can find when you run `nx graph --file=output.json`. (Plus
a little more information that is needed for IDEs 🙂)

There are more custom requests that are implemented that help with IDE integration, some of these include:

- Nx version
- Available generators
- Finding projects based on file paths

You can see all the custom requests
on [Github](https://github.com/nrwl/nx-console/blob/756fdfb545de413436193227d273d078628d7829/libs/language-server/types/src/index.ts).

**VSCode**

Language Server Protocol support is built into the core of VSCode, so using the language server there was straight
forward. Previously the logic to get workspace information was just part of the VSCode extension. This was the logic
that moved to the `nxls` .

**IntelliJ**

For JetBrains editors (IntelliJ/Webstorm), calling a language server wasn’t so obvious.

Thankfully, there were already plugins that integrated language servers using
the [lsp4j](https://github.com/eclipse/lsp4j) library. This was a great starting out point for us and we quickly got
IntelliJ/Webstorm to boot up `nxls` and start sending requests.

In future versions of IntelliJ/Webstorm, language server support is going to be fully baked into the core of the IDE
using the same lsp4j library. This means that we can remove some of the scaffolding that we had to do to get it working
without the core support.

## Generate UI

![](/blog/images/2023-03-02/0*-BMjrO5LdBCWK2TU.avif)
_Screenshot of the generate UI in IntelliJ_

As mentioned, the generate UI is a key feature of Nx Console. It allows users to easily generate code by using a
form-based view, rather than having to remember and type a series of CLI commands.

For VSCode, the only way to add a custom UI like this is to render it from inside
a [webview](https://code.visualstudio.com/api/extension-guides/webview) — similar to an iframe. IntelliJ provides the
functionality to build more complex native UIs. However, this would mean rewriting everything from scratch: how to
process Nx schemas, how to render each kind of field, validation and more. And then, each change to the UI would have to
be made in two places, greatly increasing the maintenance overhead and complexity of the codebase. This is why we
decided to reuse the existing generate UI for IntelliJ.

The generate UI is a standalone app written in Angular. It consists of a few components for the different field types
and a main component that deals with processing the schema, filtering fields and communicating with the IDE. This entire
component was quite tightly coupled with VSCode in two regions: receiving and sending data to the IDE and styling.
Naturally, these aspects had to be refactored out in order to accommodate a new host IDE.

## Communicating with IntelliJ

First, we ripped out all VSCode-specific code from the main component and moved it to a separate
[`ide-communication.service.ts`](https://github.com/nrwl/nx-console/blob/f7de7f9d1f7ae5f59b0605b2e54ef28e6325e839/libs/generate-ui/feature-task-execution-form/src/lib/ide-communication/ide-communication.service.ts#L91).
Communication with the host IDE is now done via one of two methods:

- for VSCode, we continue to use the straightforward (
  and [fully typed](https://www.npmjs.com/package/@types/vscode-webview)) `acquireVsCodeApi()` method,
  `window.addEventListener` and `webview.postMessage` .
- for IntelliJ, there is no such helper method, so we wrote a custom `window.intellijApi` object. This api will then be
  called from both the Angular app and from within Kotlin code by injecting it into JCEF (more on that later). This is
  definitely a more involved solution and less developer-friendly, but it works perfectly fine.

The service uses whatever API it finds to send and receive messages, with the rest of the app none the wiser. The
structure of the messages is identical between VSCode and IntelliJ. The fact that the Typescript-based VSCode extension
natively understands JSON is a nice upside, since we can just pass around objects between the browser and extension
without having to convert anything. For the Kotlin-based IntelliJ plugin, this needs an additional de-/serialization
step, which is easily done with [`kotlinx.serialization`](https://github.com/Kotlin/kotlinx.serialization) or
[`gson`](https://github.com/google/gson).

## Adapting Styling

One aspect that makes designing webviews for VSCode a breeze is the massive stylesheets they ship by default. Every UI
element’s colors are available in primary, secondary and disabled variants as well as fonts, background colors and more.

However, this ended up being a struggle as all styling was very tightly coupled to these VSCode stylesheets, which are
obviously not present within a different host IDE. We replaced all of the VSCode styles with custom css variables. In a
separate `generate-ui-styles` library, we map the VSCode styles to our matching variables. For IntelliJ, we extract the
the same style variables using `UIUtil` and pass them to the app.

## JCEF

To integrate the web application into IntelliJ, Nx Console
uses [JCEF (Java Chromium Embedded Framework)](https://plugins.jetbrains.com/docs/intellij/jcef.html). JCEF enables Java
applications to render web pages using Chromium. It comes with great debugging support using Chrome Devtools and we
haven’t run into any issues with it yet. The docs are sadly a bit lacking, but with some trial and error we managed to
wire everything up. I want to give a special shoutout to Rafal Mucha and his
article [Creating IntelliJ plugin with WebView](https://medium.com/virtuslab/creating-intellij-plugin-with-webview-3b27c3f87aea).
It explains how to enable JCEF to load files from the `/resources` folder bundled in the plugin JAR. There’s not much
info on this topic so this one blog post was a true lifesaver. It’s written in Scala but I learned a lot rewriting it to
Kotlin. Now we have
a [Kotlin version](https://github.com/nrwl/nx-console/blob/master/apps/intellij/src/main/kotlin/dev/nx/console/generate_ui/CustomResourceHandler.kt)
out there too!  
Communication with whatever is running in the browser works by **_injecting_** javascript code to be run into the
browser - kind of like running something in the console. This creates a little more overhead than simply posting
messages to be consumed from a listener like in VSCode. The upside is that it theoretically gives you a lot more
flexibility in what you want to do in the browser - you could talk to multiple, independent APIs and register distinct
callbacks on the host side.

## Glueing it together

One of the unique aspects of the Nx Console for IntelliJ is that it combines different technologies in a polyglot
monorepo. While Nx is often used for Typescript- or Javascript-based repos, it’s actually technology-agnostic and can
host apps and libraries in any language. With the newly released [**_Encapsulated Nx_
**](/recipes/installation/install-non-javascript) setting, this is even taken a step further! Now you don’t need a
`package.json` or `node_modules` to run Nx.

The codebase contains both Typescript code for the VSCode extension and Kotlin code for the IntelliJ plugin. Currently,
all the Kotlin code resides in a single app. Targets defined in `project.json` are available that wrap different gradle
tasks like running a development instance, building or formatting the plugin using the
[`nx:run-commands`](/nx-api/nx/executors/run-commands) executor.  
Since the plugin depends on artifacts provided by other Nx apps (namely the `nxls` and `generate-ui`), we have also
created gradle tasks that call Nx to build these dependencies under the hood. This roundabout way of calling one tool
from the other (and back again) could definitely be improved and we might look into having a more straightforward
integration later.

For the generate UI, we were able to keep it as a single app. Using different configurations for the `build` target,
we’re including the different stylesheets needed for each configuration and copying the files to where they need to be.

## Looking ahead

In the upcoming releases, we plan to integrate more features that already exist in VSCode like the nx project view as
well as add more IntelliJ-native functionality and quality-of-life changes. Our goal is to provide the same experience
and level of productivity, regardless of which IDE you prefer to use. You can join the discussion and vote on what you
think should be added on [the roadmap issue on GitHub](https://github.com/nrwl/nx-console/issues/1578).

We are also looking into automatic type generation for both TypeScript and Kotlin. Currently, all return types of the Nx
Language Server have to be maintained in both languages, but maybe we could use a tool
like [Dukat](https://github.com/Kotlin/dukat). This would help us to save time and reduce the risk of inconsistencies
between the TypeScript and Kotlin codebases.

**Learn more**

- 🎮 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 🚀 [Nx Console JetBrains plugin](https://plugins.jetbrains.com/plugin/21060-nx-console)
- 🤖 [Nx Console VSCode extension](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console)
- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
