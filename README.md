# Fluff.js

_"Just the good stuff"_

Fluff is a very lightweight web framework and component system with a syntax which will be familiar to those coming from
[Angular](https://angular.dev/).

## Why?

I love Angular, but it was too chonky for an embedded project I was working on. So this happened.

## Features

- **WebComponents-based** - Components compile to native HTML5 Custom Elements
- **Angular-like syntax** - Decorators, templates, and component structure you already know
- **Transparent data binding** - No change detector, zone.js, or digest cycles needed
- **Zero runtime dependencies** - No rxjs, no zone.js, just vanilla JS
- **Tiny footprint** - ~6 KB gzipped runtime
- **AOT compilation** - Templates are compiled at build time, not runtime
- **Control flow syntax** - Angular 17+ style `@if`, `@for`, `@switch`, plus `@fallthrough`
- **Pipes** - Transform template expressions with built-in or custom pipes, component-scoped

## Getting Started

```bash
npx @fluffjs/cli@latest generate hello-world
cd hello-world
npm install
npx @fluffjs/cli serve
```

You can also check out the [Demo app](https://fluffjs.github.io/fluff/) and
its [source](https://github.com/fluffjs/fluff/tree/master/apps/fluff-demo-app)

## What Fluff Doesn't Do

Fluff is intentionally minimal. If you need these features, you can add libraries, implement them yourself, or maybe
just use Angular :)

- **No JIT compiler** - Templates must be compiled at build time, no dynamic template compilation
- **No dependency injection** - No providers, services, or DI container
- **No legacy brower support** - ES2022 or go home
- **No routing** - No built-in router
- **No forms module** - No FormControl, FormGroup, or validation framework
- **No HTTP client** - Use fetch or your preferred HTTP library
- **No i18n** - No built-in internationalization
- **No animations** - Use CSS animations or a library like GSAP
- **No SSR** - Client-side only, no server-side rendering
- **No modules/NgModule** - Components register themselves, no module system
- **No lazy loading provide** (but pretty easy to implement)
- **Limited tooling** - Basic build + dev server only

## Decorators

| Decorator       | Description                                                          |
|-----------------|----------------------------------------------------------------------|
| `@Component`    | Define a component with selector, template, styles, and pipes        |
| `@Input`        | Declare an input property that can be bound from parent              |
| `@Output`       | Declare an output event using `Publisher<T>`                         |
| `@Reactive`     | Make a property reactive - changes automatically update the template |
| `@Watch`        | React to changes in one or more properties                           |
| `@HostBinding`  | Bind a property to a host element attribute or class                 |
| `@HostListener` | Listen to events on the host element                                 |
| `@ViewChild`    | Get a reference to a child element in the template                   |
| `@Pipe`         | Define a reusable transform for template expressions                 |

## @Watch Example

The `@Watch` decorator lets you react to changes in one or more reactive properties. The callback receives the name of the property that changed:

```typescript
import { Component, Input, Reactive, Watch } from '@fluffjs/fluff';

@Component({
    selector: 'data-grid',
    template: `<div>...</div>`
})
export class DataGridComponent extends HTMLElement
{
    @Input() public columns: string[] = [];
    @Reactive() public headers: string[] = [];

    @Watch('columns', 'headers')
    public onDataChanged(changed: string): void
    {
        if (changed === 'columns')
        {
            this.updateVisibleColumns();
        }
        else
        {
            this.updateVisibleHeaders();
        }
    }

    private updateVisibleColumns(): void { /* ... */ }
    private updateVisibleHeaders(): void { /* ... */ }
}
```

You can also use `$watch` for inline computed properties:

```typescript
const subscription = this.$watch(['firstName', 'lastName'], (changed) => {
    console.log(`${changed} was updated`);
    return this.firstName + ' ' + this.lastName;
});
```

Make sure you unsubscribe from the watch in OnDestroy.

## Example Component

```typescript
import { Component, Input, Output, Reactive, Publisher } from '@fluffjs/fluff';

@Component({
    selector: 'my-counter',
    template: `
        <div class="counter">
            <span>Count: {{ count }}</span>
            <button (click)="increment()">+</button>
        </div>
    `,
    styles: `.counter { display: flex; gap: 8px; }`
})
export class CounterComponent extends HTMLElement
{
    @Input() public initialValue = 0;
    @Reactive() public count = 0;
    @Output() public countChange = new Publisher<number>();

    public onInit(): void
    {
        this.count = this.initialValue;
    }

    public increment(): void
    {
        this.count++;
        this.countChange.emit(this.count);
    }
}
```

## Template Syntax

```html
<!-- Text interpolation -->
<span>{{ user.name }}</span>

<!-- Property binding -->
<input [value]="searchQuery"/>

<!-- Event binding -->
<button (click)="handleClick($event)">Click me</button>

<!-- Two-way binding (manual) -->
<input [value]="name" (input)="name = $event.target.value"/>

<!-- Class binding -->
<div [class.active]="isActive">...</div>

<!-- Conditional rendering -->
@if (isLoading) {
<spinner-component></spinner-component>
} @else if (hasError) {
<error-message [message]="errorText"></error-message>
} @else {
<content-component [data]="items"></content-component>
}

<!-- Loops -->
@for (item of items; track item.id) {
<item-card [item]="item" (delete)="removeItem(item)"></item-card>
} @empty {
<p>No items found</p>
}

<!-- Switch -->
@switch (status) {
@case ('loading') {
<spinner></spinner> }
@case ('error') {
<error-view></error-view> }
@default {
<main-content></main-content> }
}

<!-- Pipes -->
<span>{{ title | uppercase }}</span>
<span>{{ description | truncate:80 }}</span>
<span>{{ createdAt | date:'short' }}</span>
```

## Lifecycle Hooks

```typescript
export class MyComponent extends HTMLElement implements OnInit, OnDestroy
{
    public onInit(): void
    {
        // Called after component is connected and rendered
    }

    public onDestroy(): void
    {
        // Called when component is disconnected
    }
}
```

## Bundle Size Comparison

The [fluff demo app](https://fluffjs.github.io/fluff/), vs when ported to other frameworks

| Framework  | Runtime (gzip) | Demo App (gzip) |
|------------|----------------|-----------------|
| **Fluff**  | ~6 KB          | 16.4 KB         |
| Vue 3.5    | ~24 KB         | 31.8 KB         |
| Angular 21 | ~55 KB         | 60.5 KB         |
| React 19   | ~60 KB         | 65.5 KB         |

## Getting Started

```bash
# Install the Fluff packages
npm install @fluffjs/fluff

# Build your app
npx fluff build src/main.ts --outdir dist
```

## Project Structure

```
packages/
  fluff/       # Core runtime library (decorators, FluffElement base class)
  cli/         # Build tooling and AOT compiler
  nx/          # Nx plugin for workspace integration
apps/
  fluff-demo-app/    # Example Kanban board app
```

## License

MIT
