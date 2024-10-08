---
title: Nx Console gets Lit
slug: 'nx-console-gets-lit'
authors: [Max Kless]
cover_image: '/blog/images/2023-06-29/featured_img.webp'
tags: [nx, nx-console]
---

Over the last few weeks, we rebuilt one of Nx Console’s most liked features from the ground up: The Generate UI. It looks better, loads faster, and preliminary research shows using it makes you happier, too ;)

You can use it today by installing the latest version of Nx Console for VSCode and JetBrains IDEs! 🎉🎉🎉

- [Nx Console on the VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console)
- [Nx Console on the JetBrains Marketplace](https://plugins.jetbrains.com/plugin/21060-nx-console)

If you’re curious to learn more about the rewrite and the motivations behind it, this is the blog post for you! We’ll touch on these topics and more:

- Why did we choose to rewrite?
- What’s Lit and why did we use it over Angular?
- How did the rewrite go and what Lit features were important for us?
- What does the performance look like before and after?

{% youtube src="https://www.youtube.com/embed/p455D4W7330?si=FRbiKJhGxT8dYzf9" /%}

## Background: Why Migrate from Angular to Lit?

### A Short History of Nx Console

Let’s go back in time: Nx Console has been around for a while. It first launched in 2018 — then called Angular Console — as a standalone Electron app which let you run Angular schematics and builders from a graphical interface. Of course, it was built with Angular and looked something like this:

![Screenshot of the original Angular Console electron app](/blog/images/2023-06-29/bodyimg1.webp)

In 2019, it was ported to a VSCode extension with the now familiar UI and support for the standalone app was dropped.

In 2020, support for the entire Nx ecosystem was added, it was renamed to Nx Console and an amazing transformation began: Today, Nx Console is much more than just a single form — it tightly integrates Nx into your IDE, gives you the overview of your projects that you need and puts your task-running just a click away.

### Rewriting in Lit

This evolution brought significant improvements to the usability of Nx Console and the value we could provide to developers, but not without presenting its own set of challenges. Inevitably, the codebase grew complex and convoluted over time — the context in which it ran changed, the scope of the product changed, yet the technology remained the same. Adding small features or fixing bugs became increasingly time consuming, and every PR compounded the problem.

The UI looked somewhat outdated and had been built with only VSCode in mind — which became painfully obvious when support for JetBrains IDEs was added. While the web-based nature of the Generate UI allowed us to reuse the code in the new environment, the design looked out of place.

In addition, we started questioning our usage of Angular. Angular is a great framework for building web apps, and in the original context of Angular Console, it made a lot of sense: A tool built by and for Angular engineers — of course it’s written in Angular. But things changed, and Angular started to feel overkill for what we needed. Angular has a huge number of features right out of the box. But for our simple form, we didn’t need routing, http requests or modules to organize our code. The amount of boilerplate and overhead Angular introduces is significant.

So, ultimately, **we decided to pull the plug and rewrite the entire thing in [Lit](https://lit.dev/).**

Lit is a lightweight framework built on top of web components and “adds just what you need to be happy and productive: reactivity, declarative templates and a handful of thoughtful features to reduce boilerplate and make your job easier” (taken from their docs). We had used it before to [build the Nx Cloud view](/blog/nx-console-meets-nx-cloud) and were happy with the simple setup and great DX. So the decision to reuse it here was an easy one, since it allowed us to reuse code, build tooling and expertise. The rewrite also gave us the opportunity to improve the design for both supported IDEs and give the entire UI a clean, new coat of paint.

![Screenshot of the reworked generate ui](/blog/images/2023-06-29/bodyimg2.webp)

Before I dive deeper into specifics, let’s have a look at the general architecture of Nx Console first.

## Nx Console Architectural Overview

Nx Console is composed of 3 core parts:

- The **nxls** is a language server based on the [Language Server Protocol (LSP)](https://microsoft.github.io/language-server-protocol/) and acts as the “brain” of Nx Console. It analyzes your Nx workspace and provides information on it, including code completion and more.
- The **Generate UI** is the form-based view for running Nx generators.
- The **platform-specific wrappers**. These are written in Typescript and Kotlin and connect the rest of Nx Console to IDE-specific APIs. Having the other parts separate greatly reduces the amount of duplicated code we have to write in order to support multiple IDEs

This architecture’s modularity meant we could quickly switch out the Generate UI for a new version without significantly impacting the rest of the codebase — only the parts that actually render the UI and communicate with it had to be adjusted slightly. It also allowed us to ensure backward compatibility: the old generate UI is still available via a feature toggle in the settings.

If you want to dive deeper, there are many more resources on the architecture of Nx Console and how it’s built:

- [In-depth blog post about expanding to JetBrains IDEs](/blog/expanding-nx-console-to-jetbrains-ides)
- [Accompanying Youtube video by Zack DeRose](https://www.youtube.com/watch?v=xUTm6GDqwJM)
- [The Power of Nx Console — talk by Jon Cammisuli](https://www.youtube.com/watch?v=3C_9g9kt2KM)

## Migrating to Lit: Step by Step

To rebuild our UI, we first needed a new Lit app to work on. While there’s no native Nx plugin for Lit, generating the code we need was still very straightforward:

`nx generate @nx/web:app apps/generate-ui-v2`

This generates an entire project for us, with a `tsconfig.json`, `index.html`, `main.ts`, and a `project.json`, where our Nx-specific config lives.

I also installed a couple of dependencies:

- The `@nx/esbuild` plugin because I like fast build times 🏎️
- TailwindCSS because I don’t like writing CSS 🤫
- `@vscode/webview-ui-toolkit` because it does all of the VSCode work for me 🤖

This is really where Nx shines, because it allows you to take these tools and quickly patch them together and build a pipeline that does exactly what you need. And it also allows you to think about your workspace visually. This is what this is what my task graph for building the Lit app ultimately looks like:

![Nx task graph for building the Lit webview](/blog/images/2023-06-29/bodyimg3.webp)

You can see three build steps:

- `generate-ui-v2:_build` uses esbuild to bundle my Lit components written in Typescript and spits out a `main.js` file
- `generate-ui-v2:extract-dependencies` copies the third party assets we need into the dist folder. Right now it’s just codicons `.css` and `.ttf` files.
- `generate-ui-v2:build` finally runs tailwind over the bundled code. This could also be done with `postCss` or a custom `esbuild` plugin but running tailwind directly is the easier, so why complicate things?

> 💡 There are different ways to generate this visualisation for your own workspaces:
>
> - In VSCode, use the Nx Project View or the `Nx: Focus task in Graph` action
> - In JetBrains IDEs, use the Nx Toolwindow or context menus
> - In the command line, run `nx build {{your project}} --graph`

In the bigger context of Nx Console, here’s what happens when you build the VSCode extension:

![Nx task graph for building the VSCode extension](/blog/images/2023-06-29/bodyimg4.webp)

You can see that we’re still building both the new & old generate UI as well as the Nxls and the Nx Cloud webview before combining them all into one VSCode extension artifact.

### Building the Form

Lit is a very small library that provides useful abstractions over browser-native features like web components and messages. Here’s what a simple Lit component, written with Typescript, looks like:

```ts {% fileName="main.ts" %}
@customElement('root-element')
export class Root extends LitElement {
  render() {
    return html`<p>Hello World</p>`;
  }
}
```

```html {% fileName="index.html" %}
<!DOCTYPE html>
<html lang="en">
  <body>
    <script type="module" src="main.js"></script>
    <root-element></root-element>
  </body>
</html>
```

If you need to pass information up the DOM, you use normal events and you can set properties to send information to descendants. Check out the [Lit Docs](https://lit.dev/docs/components/rendering/) to learn more about how the render() method works, how to leverage reactivity, the shadow DOM and so much more.

> 💡 All code samples in this section have been adapted for brevity and clarity. So you won’t find this exact code anywhere, but it demonstrates the concepts well.

### Communicating with the IDE — using Reactive Controllers

To communicate with the host IDE, we were able to reuse almost all the logic from the previous UI (for more details, see [Communicating with IntelliJ](/blog/expanding-nx-console-to-jetbrains-ides) from the last blog post). Instead of a service that exposes observables that our component can consume, we used a [Reactive Controller](https://lit.dev/docs/composition/controllers/). Controllers are a neat feature of Lit — they hook into a component and can request DOM updates on their behalf. This eliminates the need for observable streams and subscriptions while keeping the communication code self-contained. Look at this example:

```ts {% fileName="main.ts" %}
@customElement('root-element')
export class Root extends LitElement {
  icc: IdeCommunicationController;

  constructor() {
    super();
    this.icc = new IdeCommunicationController(this);
  }
  render() {
    return html`${JSON.stringify(this.icc.generatorSchema)}`;
  }
}
```

```ts {% fileName="ide-communication-controller.ts" %}
// ide-communication-controller.ts
export class IdeCommunicationController implements ReactiveController {
  generatorSchema: GeneratorSchema | undefined;
  constructor(private host: ReactiveControllerHost) {}
  // ...
  private handleMessageFromIde(message: InputMessage) {
    // ...
    this.generatorSchema = message.payload;
    this.host.requestUpdate();
  }
}
```

You can see that `root-element` can really just deal with rendering the form contents, delegating communicating with the IDE and when to update the DOM to the controller.

### Rendering the form fields — using Mixins

The core part of the UI is the form. We built all kinds of inputs: text fields, checkboxes, (multi-) select boxes and array fields. While those each have unique implementations, displaying them is also going to take a lot of repeated code. Every fields needs a label and description. Every field needs to know about its validation state, how dispatch change events and what aria attributes to set. In order to keep this code clean and DRY, we used [Class Mixins](https://lit.dev/docs/composition/mixins/). Mixins aren’t really a Lit-specific feature, but I don’t see them used much in other frameworks. A mixin is essentially a factory that takes a class and returns another, modified class. Check out this example:

```ts {% fileName="field-mixin.ts" %}
const Field = (superClass) =>
  class extends superClass {
    // we can define (reactive) properties that every field is going to need
    @property()
    option: Option;
    protected get fieldId(): string {
      return `${this.option.name}-field`;
    }

    // we can define methods that should be available to all fields
    dispatchValue(value: string) {
      // ...
    }
  };
```

```ts {% fileName="field-wrapper-mixin.ts" %}
const FieldWrapper = (superClass) =>
  class extends superClass {
    // we can define a render() method so that fields are all rendered the same
    protected render() {
      return html` <label for="${this.fieldId}">${this.option.name}</label>
        <p>${this.option.description}</p>
        ${this.renderField()}`;
    }
  };
```

```ts {% fileName="input-field.ts" %}
@customElement('input-field')
export class InputField extends FieldWrapper(Field(LitElement)) {
  renderField() {
    return html` <input
      id="${this.fieldId}"
      @input="${(e) => this.dispatchValue(e.target.value)}"
    />`;
  }
}
```

You can see that each component and mixin deals with a specific subset of the overall logic, keeping our code cleanly separated and reusable. A checkbox, for example, is a special case because it’s layout on the page is slightly different — no problem, we simply wrote a CheckboxWrapper with some modifications without having to worry about changing the checkbox logic itself.

> 💡 Properly typing mixins is complicated so I left that part out. Refer to [Mixins in Typescript](https://lit.dev/docs/composition/mixins/#mixins-in-typescript) to learn more or [check out our source code on GitHub](https://github.com/nrwl/nx-console).

### Injecting Services & Data — Lit Context

If you’re coming from the Angular world, you probably appreciate the great dependency injection (DI) mechanism they have. You can centrally define some services and reuse them across your app, without thinking about passing on props from component to component — the DI system takes care of it. Lit provides something similar via the []`@lit-labs/context`](https://lit.dev/docs/data/context/) package. It’s based on the [Context Community Protocol](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md) and similar to React’s context API.

Under the hood, it still works with normal browser events, but it abstracts it away from you so you can easily share data and services across your app.

The Generate UI is rendered in both VSCode and JetBrains IDEs. In order to look appropriate, components need to know which environment they’re in and adjust styling accordingly. Instead of passing this information from component to component, we can make it available contextually! And with a proper mixin, reading the editor context only has to be implemented once, too.

Have a look at the following example:

```ts {% fileName="editor-context.ts" %}
export const editorContext = createContext<'vscode' | 'intellij'>(
  Symbol('editor')
);

const EditorContext = (superClass) =>
  class extends superClass {
    @consume({ context: editorContext })
    @state()
    editor: 'vscode' | 'intellij';
  };
```

```ts {% fileName="ide-communication-controller.ts" %}
export class IdeCommunicationController implements ReactiveController {
  // ...
  constructor(private host: ReactiveElement) {
    const editor = isVscode() ? 'vscode' : 'intellij';
    // provide the context to all DOM children of the host element
    new ContextProvider(host, {
      context: editorContext,
      initialValue: editor,
    });
  }
}
```

```ts {% fileName="some-component.ts" %}
@customElement('some-component')
export class SomeComponent extends EditorContext(LitElement) {
  render() {
    return html`<p>I am rendered in ${this.editor}</p>`;
  }
}
```

### VSCode Webview UI Toolkit

As we mentioned above, a big part of why we rewrote the UI is that it looked quite out of place in JetBrains IDEs. It was still useful, of course, but it’s important to make sure the form _feels_ right.

In VSCode, this is very easy to achieve, thanks to the [VSCode Webview UI Toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit). It’s a set of web components, provided by Microsoft, that are designed to look good and be used in VSCode webviews.

![Sample image of the VSCode Webview UI Toolkit showing the different components it provides](/blog/images/2023-06-29/bodyimg5.webp)

Using it, you get the native look, a11y, and theme-aware styling for free! Thanks to everyone who built it, it’s a huge help!

### E2E Testing with Cypress

One big upside of using a webview is the huge Javascript ecosystem is available to you! To make sure that no regressions are introduced later on, we use [Cypress](https://www.cypress.io/). We can mock the editor communication and provide different schemas, make sure the form is rendered correctly and the right messages are sent back to the IDE.

While there’s no particular Lit integration for Cypress, the tool itself is framework agnostic so it still works perfectly fine. Using the [`@nx/cypress`](/nx-api/cypress) executors did most of the work for us so setup was pretty quick too.

### Results: Comparing Performance

There’s a number of different aspects to performance we can compare between the two implementations. The biggest one by far is not really quantifiable: The maintainability and looks of the new UI. In my opinion, it looks a lot fresher and more native in both environments. We got rid of a lot of legacy code and the new version is easier to reason about and work with.
But there are thing we _can_ measure, so let’s talk numbers!

### Startup Time

It takes time to bootstrap a large framework like Angular, so skipping that, the UI should load quicker than before.

We measured the median time it took to render all options of the `@nx/angular:application` generator in both VSCode and IntelliJ. You can see that the results are pretty clear-cut, even though they are not hugely impactful.

Old UI (Angular)New UI (Lit)SpeedupVSCode65 ms39 ms~ 1.7xIntelliJ189 ms122 ms~ 1.5x

### Bundle Size

As mentioned earlier, Angular comes with a lot more features out-of-the-box than Lit, so it would make sense that the built bundle will be bigger.

We were able to reduce the bundle size (w/o compression) from about 733 kB to 282 kB, which comes out to about a 2,6x decrease. Unlike a website, where the bundle needs to be shipped to users when they load a page, Nx Console users only need to download it once when installing the plugin. This means we’re not affected by network speeds after installation, which makes the bundle size less critical.

> 💡 Because of a misconfiguration from a few Angular versions ago, the bundle size that we reported in [this tweet](https://twitter.com/MaxKless/status/1671095858182381569) was overly bloated. We corrected it, but Lit still came out ahead in terms of size and rendering times.

### Build Time

While it might not be important to users of Nx Console, the time it takes to build the project makes a difference to us developers.

Since Lit is just javascript files that don’t require a custom compiler or build tooling, we decided to use [`esbuild`](https://esbuild.github.io/) (via `@nx/esbuild`), which is written in Go and extremely fast. On the other hand, the old UI used the `@angular-builders/custom-webpack:browser` builder, which uses webpack under the hood.

We went from about 3.5 seconds to less than 2 seconds of build time, which is less of an improvement than we expected. Since we also have to run tailwind over our files, some of that additional `esbuild` speed seems to be relativized.

## Looking Ahead

Rebuilding the UI has paved the road to reduce a lot of the maintenance burden of Nx Console. It will allow us to move even quicker on building new features to provide the best developer experience possible for you.

Specifically, the updated architecture enabled us to build a (still secret and WIP) plugin feature for Nx Console. Just like Nx, there are always going to be things that are unique to your workspace. We want to make it easy for you to extend and modify Nx Console in ways that help you make the most of using it.

So keep your eyes peeled for announcements and let us know via GitHub or Twitter if you have any ideas! We’d love to chat.

## One more thing!

Nx Console is a tool by developers for developers and there’s one thing we love — keyboard shortcuts. So of course we had to build some in. In addition to being keyboard-friendly and tabbable, you can do the following:

- `Cmd/Ctrl + Enter` to run the generator
- `Cmd/Ctrl + Shift + Enter` to start a dry run
- `Cmd/Ctrl + Shift + S` to focus the search bar and look for a specific option. Just `tab` to get back to the form

If the prettier UI and better performance haven’t convinced you, this surely will! 😉

---

## Learn more

- [Nx Docs](/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools) -- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
