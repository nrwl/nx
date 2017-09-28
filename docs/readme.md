# Nrwl Extensions for Angular

Nrwl Extensions, or **Nx** for short, is a set of schematics and libraries for the Angular platform.
The schematics extend the power and capabilities of the [AngularCLI](https://github.com/angular/angularcli) by 
providing file/folder structure for enterprise Angular development as well as providing generator recipes for
creating new code in your applications. The libraries provide a set of code that you can import and use 
to simplify common patterns and functionality in your Angular applications.

#### Why Nx?

Large companies have specific requirements when it comes to building software.
- They don't build small apps. They have multiple teams building multiple apps using multiple shared libs. It's many to many to many. Organizing this dev workflow is challenging.
- They care about consistency. AngularCLI has great starting conventions but there is a need for more. State management, routing, even small things code formatting.
- They have legacy AngularJS apps they need to migrate. NgUpgrade is great, but still a lot of work to set up.
- They want to write robust, proven code: error handling, race conditions.

**Nx** helps achieve those requirements.
- It gives you Nx Workspace, a monorepo way of building frontend apps. The same approach used by Google, Facebook, Uber, Twitter and many others.
- It gives you code generation abilities to generate state management stuff and routing. It also comes with runtime libraries to make your code more robust. It comes with a code formatter (used by Google!).
- It comes with code generation abilities to set up a hybrid app in minutes. So you can take advantage of your existing AngularJS code right away.

#### Getting Started
Since **Nx** is designed to enhance the AngularCLI you will want to have that installed globally along with `@nrwl/schematics`:
```
yarn global add @angular/cli
yarn global add @nrwl/schematics
```

>A note on [Yarn](https://yarnpkg.com/en/)  
Yarn does a better job at recognizing and dealing with multiple peer dependencies on globally installed
packages, thus is recommended (but not a hard requirement)

<div style="display: flex; flex-direction: row;">
    <div>
        <h4>Nx Workspaces</h4>
        <p>Create new mono repo workspaces or update an existing AngularCLI project to be a mono repo workspace.
        Add Angular apps and Angular libs to an existing Nx Workspace.</p>
        <a href="nx-workspace.md">Docs</a>
    </div>
    <div>
        <h4>Code Generation</h4>
        <p>Create files for NgRx state implementation with a single command. Generate the code
        needed to run an AngularJS shell app in Angular.</p>
        <a href="code-generation.md">Docs</a>
    </div>
    <div>
        <h4>Angular Library</h4>
        <p>Classes and functions to simplify implementation of common patterns that you can
        `import` and use in your code.</p>
        <a href="nx-library.md">Docs</a>
    </div>
</section>
