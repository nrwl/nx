---
title: Angular State Management for 2025
slug: angular-state-management-2025
authors: ['Mike Hartington']
tags: [angular]
cover_image: /blog/images/2024-12-16/thumbnail.avif
description: Discover how Angular Signals and modern state management approaches simplify application development in 2025.
---

## Revisiting State Management

The topic of state management in apps is something developers can spend countless hours discussing and never agree on what the "right" solution is. Truth is, there are so many solutions out there these days and they all share similar concepts that you can't really pick wrong. This is true in most frontend frameworks, but especially true in Angular, where the framework has introduced several new features in the past year that make managing state simpler than ever. Let's take a look at some approaches to state management in Angular that take advantage of modern features of the framework and can set us up for success in 2025.

## Signals Only, No Library

In recent versions of Angular, the framework has introduced a new primitive called Signals. Signals provide a way to store a value, update that value, and react to when that value changes. This sounds like features that you would get from a full featured state management library. The benefit of using Signals without any additional libraries is that you can make things work for you how ever you want. If you have opinions on how you want to construct your state and manage updates, raw Signals can accommodate this.

```ts
@Component({
  template: `
    <p>Hello, {{ name() }}</p>
    <button (click)="updateName()">Update</button>
  `,
})
export class MessageComponent {
  name = signal('World');
  constructor() {
    effect(() => {
      console.log('Name has changed: ', this.name());
    });
  }
  updateName() {
    this.name.set('Mike');
  }
}
```

The built-in methods on the `signal` make creating a simple local store very easy to do. If you take Signals and utilize a service, you create your own mini-store.

```ts
export class AppStore {
  readonly state = signal([]);

  add(item) {
    this.state.update((oldState) => [...oldState, item]);
  }
  delete(item) {
    this.state.update((oldState) => oldState.filter((e) => e.id !== item.id));
  }
  update(item) {
    this.state.update((oldState) =>
      oldState.map((e) => (e.id === item.id ? item : e))
    );
  }
}
```

Now this is just a very basic approach to managing state, but if you do not want to reach for an additional libray, you could get pretty far with this basic solution. Throw a few `effect`s in there if you need to perform some side effects, and you're golden.

## Signal State

If you've been around Angular long enough, you've probably reached for NgRx before, and with good reason. NgRx provides a standard way of managing state in your app that is scalable and testable. In the past, NgRx has provided a store solution based on RxJS, but in more recent releases, NgRx provides two new API based on Signals, Signal State and Signal Store.

Signal State is a lightweight API meant to be used in smaller, more isolated scenarios, where a full redux-like API isn't needed. This could be in small to medium sized apps, and in the component itself or extracted to a service.

Reworking our previous example, we can take our signal-based store and update it to use Signal State:

```ts
import { patchState, signalState } from '@ngrx/signals';
export class AppStore {
  readonly state = signalState<Store>({ items: [] });

  addToStore(item: StoreItem) {
    patchState(this.state, (oldState) => ({
      ...oldState,
      items: [...oldState.items, item],
    }));
  }
  removeFromStore(item: StoreItem) {
    patchState(this.state, (oldState) => ({
      ...oldState,
      items: oldState.items.filter((e) => e.id !== item.id),
    }));
  }
  updateStore(item: StoreItem) {
    patchState(this.state, (oldState) => ({
      ...oldState,
      items: oldState.items.map((e) =>
        e.id === item.id ? { ...item, name: 'bar' } : e
      ),
    }));
  }
}
```

Instantly, some things should stand out to you. First, we use the new `signalState` function, instead of the raw `signal` API. Now we can have a more type safe mechanism for interacting with our state. Second, we're no long passing an array. `signalState` only accepts an object/record like value. If you need an array, you put that on a property of the state.

Finally, the way we interact with our state is different. Instead of manipulating the state directly, we use the `patchState` function instead. `patchState` takes the state we want to manipulate, and uses a function to return a new version of that state. To add a new item to our `items` object, we can simply use the spread operator. Removing an item means we use `filter`, and updating an item means we use `map`. What's great about this is not only are we doing things in an immutable way, we're also getting all the types from our state. If we pass along a type that our state doesn't recognize, we'll get a type error before we even save.

## Signal Store

So Signal State is a more prescriptive way of handling smaller state, be it in a component or service. What is Signal Store all about? Signal Store is the more robust solution that you would expect for NgRx. It still is based on Signals, keeping the structure that most larger teams would want for this state solutions. Again, let's rework our previous example and update it for Signal Store.

```ts
const AppStore = signalStore(
  withState<Store>({
    items: [],
  }),
  withMethods((state) => ({
    addToStore(item: StoreItem) {
      patchState(state, (oldState) => ({
        ...oldState,
        items: [...oldState.items, item],
      }));
    },
    removeFromStore(item: StoreItem) {
      patchState(state, (oldState) => ({
        ...oldState,
        items: oldState.items.filter((e) => e.id !== item.id),
      }));
    },
    updateStore(item: StoreItem) {
      patchState(state, (oldState) => ({
        ...oldState,
        items: oldState.items.map((e) =>
          e.id === item.id ? { ...item, name: 'bar' } : e
        ),
      }));
    },
  }))
);
```

Here, we're starting to see a more structured approach to managing state that isolates our state interactions from the rest of our app. Instead of creating a service, we use the `signalStore` function instead. `signalStore` will return an injectable service instead that we provide to a component, or our root app instance. From here, we pass a `withState` function to provide any actual state value to the store. Like `signalState`, this is an object/record only.

For modifying our store, we can use the `withMethods` function and pass any methods we want to expose to our app. What stands out here is that our store's value is accessible without having to inject it. Similar to `signalState`, we use the `patchState` to make any changes we need. Since the mechanism to modify the store in `signalStore` is very close to what we had in `signalState`, it's very approachable when migrating from your simple local store to something more full featured. So if your app and team grow significantly, this is a great path forward.

## Parting Thoughts

If you've tried managing state using something like NgRx or other redux-inspired APIs, signal-based solutions are a breath of fresh air. Whether you are just building a small app and just want to use the raw signal API, or if you are in a large enterprise and want a structured approach to managing things, Signal State or Signal Store are both excellent solutions. Check out the Angular docs on the Signals or NgRx's docs on Signal State or Signal Store

- [Signals](https://angular.dev/essentials/signals)
- [Signal State](https://ngrx.io/guide/signals/signal-state)
- [Signal Store](https://ngrx.io/guide/signals/signal-store)

Also, make sure to check out:

- [Nx Docs](https://www.notion.so/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools)
- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Bluesky](https://bsky.app/profile/nx.dev)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
