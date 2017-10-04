# Bazel CLI

[Bazel](https://bazel.build/) is a powerful build tool created at Google.

It is rock solid and scales really well. (Bazel is an open source version of the tool used at Google. Facebook, Uber, Twitter all use similar tools.)



## Bazel and Nx Workspace

A big part of Nx is the idea of a single workspace, where you develop all your Angular applications. The cost of creating a new library in such a setup is extremely low, which promotes code reuse and better factoring of code.

The stable version of Nx Workspace is built on top of the latest version of the Angular CLI: it uses the AotPlugin, Karma, and WebPack. It works well.

But can we make it even better if we add bazel into the picture? After all, it's built for handling this exact scenario. We started collaborating with the Angular team (big thanks to Alex Eagle and Hans Larsen) to find this out, and the `@nrwl/bazel` package is the result of this experiment.



## Bazel CLI



### Installing Bazel and the Bazel CLI

1. First, install bazel. See [instructions here](https://docs.bazel.build/versions/master/install-os-x.html).
2. Currently the Angular CLI only supports the customization of code generation via schematics, so the default distribution of the CLI won't work with Bazel. (The CLI is going to get more generic in Q4, so this may change.) So you need to install the bazel-backed fork of the CLI, like this:

```
yarn global add nrwl/bazel-cli-build
```

3. Next, install the `@nrwl/bazel` package, which is a set of schematics for the CLI.

```
yarn global add nrwl/bazel
```


### Creating a Project

Run `ng new myapp --collection=@nrwl/bazel` to create a bazel-aware project. You'll notice the `WORKSPACE` and `BUILD.bazel` files in there. Similar to the stable Nx Workspace, there are the `apps` and `libs` directories, and they are empty.


### Creating a Library

Next, create an Angular library by running `ng generate nglib shared`.

Update `libs/shared/src/shared.module.ts`:

```typescript
import { NgModule, Component } from '@angular/core';

@Component({
  selector: 'logo',
  template: 'LOGO'
})
export class LogoCmp {}

@NgModule({
  declarations: [LogoCmp],
  exports: [LogoCmp ]
})
export class SharedModule {
}
```

Now, build it by running `ng build shared`.

You can also build it in the watch mode by running: `ng build shared --watch`.


### Creating an Application

Next, create an Angular application by running `ng generate app myapp`.

Build it by running `ng build myapp`. Run the tests by running `ng test myapp`.

Finally, serve it by running `ng serve myapp`.


### Add a Dependency from an App to a Lib

Update `apps/myapp/BUILD.bazel`:

```python
ng_module(
  name = "module",
  srcs = glob(["**/*.ts"], exclude = ["e2e/**/*.ts"]),
  assets = glob(["**/*.css", "**/*.html"]),
  deps = [
    "//libs/shared:module"
  ],
  tsconfig = "//:tsconfig.json"
)
```

Note: Modifying `BAZEL.build` will not be needed in the future.


Update `apps/myapp/src/app/app.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { BrowserModule } from '@angular/platform-browser';
import { SharedModule } from 'shared';

@NgModule({
  imports: [
    BrowserModule,
    SharedModule
  ],
  declarations: [AppComponent],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

Finally, update `apps/myapp/src/app/app.component.html`:

```html
<p>
  app works!
</p>
<logo></logo>
```

If you serve the app again, you will see the logo properly displayed. If you change the logo component, the page will reflect the change.

## Why Bazel?

Now when we learned how to use, let's talk about "why".

Bazel uses advanced local and distributed caching techniques. It uses dependency analysis, so it can run operations in parallel. This means that you if you having a giant codebase, Bazel is a good way to make sure your build times are small. For instance, the whole Google code base is in a single repository. This repository is built by an internal version of Bazel. And you still get a one-second refresh time. If it scales for Google, it will scale for your organization.


## Status

IMPORTANT: This is an experiment. Do not use it in production.
