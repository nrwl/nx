# Standalone APIs with NgRx and Angular 15

Standalone APIs were added to version 15 of [NgRx](https://ngrx.io), allowing for easier usage of NgRx with Standalone Components in Angular.  
They must be added to routes definitions as they need to be added to the Environment Injector (https://ngrx.io/api/store/provideStore).

Nx will use these Standalone APIs when:

1. Standalone APIs are supported
2. Angular 15 is installed

This guide will show you how to leverage this using the NgRx generator.

{% callout type="check" title="Prerequisites" %}  
Before following along with this guide, ensure you have:

1. An Nx >= 15.6.0 Workspace with `@nx/angular` installed
2. Angular 15 must be installed

{% /callout %}

## Steps

1. Generate an Angular application with Standalone Components and routing

```bash
nx g @nx/angular:app testapp --standalone --routing
```

2. Generate NgRx Root State

{% tabs %}
{% tab label="Nx Standalone Repo" %}

```bash
nx g @nx/angular:ngrx --root --parent=testapp/src/main.ts
```

{% /tab %}
{% tab label="Nx Integrated Monorepo" %}

```bash
nx g @nx/angular:ngrx --root --parent=apps/testapp/src/main.ts
```

{% /tab %}
{% /tabs %}

3. Generate NgRx Feature State

{% tabs %}
{% tab label="Nx Standalone Repo" %}

```bash
nx g @nx/angular:ngrx users --parent=testapp/src/app/app.routes.ts
```

{% /tab %}
{% tab label="Nx Integrated Monorepo" %}

```bash
nx g @nx/angular:ngrx users --parent=apps/testapp/src/app/app.routes.ts
```

{% /tab %}
{% /tabs %}
