---
title: Federate a Module
description: Learn how to share code between applications at runtime using Module Federation in Nx, including creating and configuring modules to be federated in React and Angular applications.
filter: 'type:Guides'
---

Module Federation is a concept that allows developers to share code between applications at run-time. It is a way of doing micro-frontends, but it can also be used to share code between applications that are not micro-frontends.

In the context of Module Federation, a _module_ can be thought as any piece of code, functionally independent, that can be reused in different applications. It can be a component, a service, a library, a utility, etc.

In order to share a module, it must be _federated_. This means that the module must be configured to be shared, and the application that wants to use it must be configured to use it.

**Nx** includes first-class support for Module Federation for React and Angular applications. This means that you can federate modules in your workspace with a few simple commands.

{% aside type="note" title="Assumption" %}
With this recipe we assume that you have already created a workspace with at least one React or Angular Module Federation host application.
If you haven't, you can follow the [Create a Host Recipe](/docs/technologies/module-federation/guides/create-a-host).
{% /aside %}

## Step 1: Create the module

We will create a module that exports a hello function.
Since we are using Nx, we will create a library for this module.

**Create a library**

```shell
nx generate @nx/js:library hello --unitTestRunner=jest
```

Update the `hello.ts` file with the following code:

```typescript
// hello/src/lib/hello.ts
export default function hello(): string {
  return 'Hello from Nx';
}
```

Update `hello/` barrel file `index.ts` with the following code:

```typescript
// hello/src/index.ts
export { default } from './lib/hello';
```

## Step 2: Federate the module

Now that we have created the module, we need to configure it to be federated.

{% tabs %}
{% tabitem label="React" %}

```shell
nx generate @nx/react:federate-module hello/src/index.ts --name=hello --remote=greeting
```

{% /tabitem %}
{% tabitem label="Angular" %}

```shell
nx generate @nx/angular:federate-module hello/src/index.ts --name=hello --remote=greeting
```

{% /tabitem %}
{% /tabs %}

{% aside type="note" title="Remote does not exist" %}
If the remote provided does not exist (in this instance _greeting_), Nx will create it for you.
{% /aside %}

This command will:

- Adds a module entry to the `greeting` remote module federation config file.

{% tabs %}
{% tabitem label="Typescript Config File" %}

```typescript
// greeting/module-federation.config.ts
import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'greeting',
  exposes: {
    './Module': './src/remote-entry.ts',
    './Hello': 'hello/src/index.ts', // <-- this line was added,
  },
};
export default config;
```

{% /tabitem %}
{% tabitem label="Javascript Config File" %}

```javascript
// greeting/module-federation.config.js
module.exports = {
  name: 'greeting',
  exposes: {
    './Module': './src/remote-entry.ts',
    './Hello': 'hello/src/index.ts', // <-- this line was added
  },
};
```

{% /tabitem %}
{% /tabs %}

- Adds a Typescript path mapping to the `greeting/Hello` module in your root TSConfig file.

```json
// /tsconfig.base.json
{
  "paths": {
    "greeting/Module": ["greeting/src/remote-entry.ts"],
    "greeting/Hello": ["hello/src/index.ts"] // <-- this line was added
  }
}
```

## Step 3: Use the module

Update the host application to use the federated module.

{% tabs %}
{% tabitem label="Typescript Config File" %}

```ts
// host/module-federation.config.ts
import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'host',
  remotes: ['greeting'], //  <-- Ensure that greeting remote is listed here
};

export default config;
```

{% /tabitem %}
{% tabitem label="Javascript Config File" %}

```javascript
// host/module-federation.config.js
module.exports = {
  name: 'host',
  remotes: ['greeting'], //  <-- Ensure that greeting remote is listed here
};
```

{% /tabitem %}
{% /tabs %}

```tsx
// host/src/app/app.tsx
import hello from 'greeting/Hello';

export function App() {
  return <div>{hello()}</div>;
}

export default App;
```

If you are using Angular, you would update the application in a similar fashion to use the federated module.

## Step 4: Run the application

Just run the application as usual.

```shell
nx serve host
```

To start the application, use the following address: [http://localhost:4200](http://localhost:4200). Once opened, you'll see the message **"Hello from Nx"**. This message is loaded from the greeting remote, which runs on port 4201.
