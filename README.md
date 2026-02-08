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
## Bundle Size Comparison


The [fluff demo app](https://fluffjs.github.io/fluff/), vs when ported to other frameworks

| Framework  | Runtime (gzip) | Demo App (gzip) |
|------------|----------------|-----------------|
| **Fluff**  | ~6 KB          | 15.6 KB         |
| Vue 3.5    | ~24 KB         | 31.8 KB         |
| Angular 21 | ~55 KB         | 60.5 KB         |
| React 19   | ~60 KB         | 65.5 KB         |

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
- **No dependency injection** - You need to manage this yourself
- **No legacy browser support** - ES2022 or go home
- **No routing** - No built-in router
- **No forms module** - No FormControl, FormGroup, or validation framework
- **No HTTP client** - Use fetch or your preferred HTTP library
- **No i18n** - No built-in internationalization
- **No animations** - Use CSS animations or a library like GSAP
- **No SSR** - Client-side only, no server-side rendering
- **No modules/NgModule** - Components register themselves, no module system
- **No lazy loading provided** (but pretty easy to implement)
- **Limited tooling** - Basic build + dev server only

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

<!-- Style binding -->
<div [style.background-color]="bgColor">...</div>
<div [style.width]="width + 'px'">...</div>

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

## Decorators

| Decorator       | Description                                                          |
|-----------------|----------------------------------------------------------------------|
| `@Component`    | Define a component with selector, template, styles, and pipes        |
| `@Input`        | Declare an input property that can be bound from parent              |
| `@Output`       | Declare an output event using `Publisher<T>`                         |
| `@Reactive`     | Make a property reactive - changes automatically update the template |
| `@Watch`        | React to changes in one or more properties                           |
| `@HostBinding`  | Bind a property to a host element attribute, class, or style         |
| `@HostListener` | Listen to events on the host element, document, or window            |
| `@ViewChild`    | Get a reference to a child element in the template                   |
| `@LinkedProperty` | Intercept when a Property is linked to a parent                    |
| `@Pipe`         | Define a reusable transform for template expressions                 |

## @Pipe Example

The `@Pipe` decorator lets you create reusable transforms for template expressions. There are two ways to define pipes:

### Class-level Pipe (Recommended)

Create a standalone pipe class that can be used across your entire application:

```typescript
import { Pipe, PipeTransform } from '@fluffjs/fluff';

@Pipe('uppercase')
export class UppercasePipe implements PipeTransform
{
    public transform(value: unknown): string
    {
        return String(value).toUpperCase();
    }
}

@Pipe('truncate')
export class TruncatePipe implements PipeTransform
{
    public transform(value: unknown, length: number = 50): string
    {
        const str = String(value);
        return str.length > length ? str.slice(0, length) + '...' : str;
    }
}
```

Then use in any template:

```html
<span>{{ title | uppercase }}</span>
<span>{{ description | truncate:80 }}</span>
```

The pipe class is automatically registered when it's imported anywhere in your app. Make sure your pipe files are included in your build entry point.

### Method-level Pipe

You can also define pipes as methods within a component:

```typescript
import { Component, Pipe, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'my-component',
    template: `<span>{{ price | currency }}</span>`
})
export class MyComponent extends HTMLElement
{
    @Reactive() public price = 99.99;

    @Pipe('currency')
    public formatCurrency(value: unknown): string
    {
        return '$' + Number(value).toFixed(2);
    }
}
```

Method-level pipes are scoped to the component where they're defined.

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

## @HostBinding Example

The `@HostBinding` decorator binds a property or getter to the host element. It supports classes, attributes, and styles:

```typescript
@Component({
    selector: 'my-button',
    template: `<span><slot></slot></span>`
})
export class MyButtonComponent extends HTMLElement
{
    @Reactive() public isDisabled = false;
    @Reactive() public theme = 'primary';

    @HostBinding('class.disabled')
    public get disabledClass(): boolean
    {
        return this.isDisabled;
    }

    @HostBinding('attr.data-theme')
    public get dataTheme(): string
    {
        return this.theme;
    }
}
```

## @HostListener Example

The `@HostListener` decorator listens to events on the host element, document, or window:

```typescript
@Component({
    selector: 'keyboard-handler',
    template: `<div>Press Escape to close</div>`
})
export class KeyboardHandlerComponent extends HTMLElement
{
    @HostListener('click')
    public onClick(event: MouseEvent): void
    {
        console.log('Host clicked');
    }

    @HostListener('document:keydown.escape')
    public onEscapeKey(): void
    {
        this.close();
    }

    @HostListener('window:resize')
    public onWindowResize(): void
    {
        this.recalculateLayout();
    }
}
```

Supported event modifiers: `.enter`, `.escape`, `.space`

## @ViewChild Example

The `@ViewChild` decorator gets a reference to a child element using a template ref or CSS selector:

```typescript
@Component({
    selector: 'form-component',
    template: `
        <input #nameInput [value]="name"/>
        <button (click)="focusInput()">Focus</button>
    `
})
export class FormComponent extends HTMLElement
{
    @ViewChild('nameInput') public inputEl!: HTMLInputElement;
    @Reactive() public name = '';

    public focusInput(): void
    {
        this.inputEl.focus();
    }
}
```

## @Input Options

The `@Input` decorator accepts options to control data flow direction and commit timing:

```typescript
@Component({
    selector: 'child-component',
    template: `<span>{{ value }}</span>`
})
export class ChildComponent extends HTMLElement
{
    @Input({ direction: Direction.Inbound })
    public readOnlyValue: string | null = null;

    @Input({ direction: Direction.Outbound })
    public writeOnlyValue: string | null = null;

    @Reactive() public isConfirmed = false;

    @Input({ commitTrigger: 'isConfirmed' })
    public deferredValue: string | null = null;
}
```

| Option | Description |
|--------|-------------|
| `direction` | `Direction.Inbound` (parent→child only) or `Direction.Outbound` (child→parent only) |
| `commitTrigger` | Name of a reactive property - changes only push to parent when trigger becomes truthy |


## Services and Data Models

While `@Reactive` can only be used inside components, Fluff provides the `Property<T>` class for reactive state management anywhere in your application - services, data models, stores, or plain classes.

### Basic Usage

```typescript
import { Property, Direction } from '@fluffjs/fluff';

class UserService
{
    public readonly currentUser = new Property<User | null>({ initialValue: null });
    public readonly isLoggedIn = new Property<boolean>({ initialValue: false });

    public login(user: User): void
    {
        this.currentUser.setValue(user);
        this.isLoggedIn.setValue(true);
    }

    public logout(): void
    {
        this.currentUser.setValue(null);
        this.isLoggedIn.setValue(false);
    }
}

export const userService = new UserService();
```

### Two-Way Binding with Data Models

When you pass a `Property` directly to a component's `@Input`, changes flow both ways automatically:

```typescript
class TaskModel
{
    public static readonly selectedTask = new Property<Task | null>({ initialValue: null });
    public static readonly taskCount = new Property<number>({ initialValue: 0 });
}

@Component({
    selector: 'task-editor',
    template: `<task-form [task]="TaskModel.selectedTask"></task-form>`
})
export class TaskEditorComponent extends HTMLElement
{
    public TaskModel = TaskModel;
}

@Component({
    selector: 'task-form',
    template: `<input [value]="task?.name" (input)="updateName($event.target.value)"/>`
})
export class TaskFormComponent extends HTMLElement
{
    @Input() public task: Task | null = null;

    public updateName(name: string): void
    {
        if (this.task)
        {
            this.task = { ...this.task, name };
        }
    }
}
```

When `TaskFormComponent` updates `this.task`, the change propagates back to `TaskModel.selectedTask` automatically.

### Intercepting Property Links with @LinkedProperty

The `@LinkedProperty` decorator lets you intercept when a `Property` is linked to a parent, useful for setting up additional subscriptions or transformations:

```typescript
@Component({
    selector: 'device-panel',
    template: `<span>{{ status }}</span>`
})
export class DevicePanelComponent extends HTMLElement
{
    @Input() public device: Device | null = null;
    @Reactive() public status = 'unknown';

    @LinkedProperty('device')
    public onDeviceLinked(deviceProp: Property<Device | null>): void
    {
        deviceProp.onOutboundChange.subscribe((device) =>
        {
            this.status = device?.isOnline ? 'online' : 'offline';
        });
    }
}
```

### Subscribing to Changes

```typescript
import { Direction } from '@fluffjs/fluff';

const subscription = userService.currentUser.subscribe(Direction.Any, (user) =>
{
    console.log('User changed:', user);
});

subscription.unsubscribe();
```

### Important Caveats

**Property values don't unwrap during evaluation:** When using raw `Property` objects in expressions, the result is unwrapped but the Property itself is not unwrapped before the expression is evaluated. This means you cannot access nested properties:

```html
<!-- Won't work - userProperty is a Property object during evaluation -->
<span>{{ userProperty.name }}</span>

<!-- Use getValue() to access the underlying value -->
<span>{{ userProperty.getValue()?.name }}</span>

<!-- Simple interpolation works - result is unwrapped -->
<span>{{ userProperty }}</span>

<!-- Pipes also work - they receive the unwrapped value -->
<span>{{ userProperty | formatUser }}</span>
```

**Data binding works naturally:** When binding a `Property` to an `@Input`, the framework handles the connection:

```html
<!-- The child's @Input receives and links to the Property -->
<child-component [user]="userProperty"></child-component>
```

**Resetting the link:** If you need to disconnect a child `Property` from its parent, call `reset()`:

```typescript
this.__myInputProperty.reset();
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
