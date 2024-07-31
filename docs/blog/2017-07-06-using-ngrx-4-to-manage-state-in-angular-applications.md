---
title: 'Managing State in Angular Applications using NgRx'
slug: 'using-ngrx-4-to-manage-state-in-angular-applications'
authors: ['Victor Savkin']
cover_image: '/blog/images/2017-07-06/1*RWAFRAQrxs2Y83xDTa_-Rg.png'
tags: [nx, release]
---

_Victor Savkin is a co-founder of Nrwl. We help companies develop like Google since 2016. We provide consulting, engineering and tools._

Managing state is a hard problem. We need to coordinate multiple backends, web workers, and UI components, all of which update the state concurrently.

What should we store in memory and what in the URL? What about the local UI state? How do we synchronize the persistent state, the URL, and the state on the server? All these questions have to be answered when designing the state management of our applications.

In this article I will cover six types of state, the typical mistakes we make managing them in Angular applications, and how to use NgRx to fix the mistakes.

_UPDATED August 2019. I wrote the original version of this post in July 2017. I got a lot of feedback from folks in the two years. I incorporated it into this version. I also updates the code samples, made them modern. I use NgRx 8, entity, creator functions. I use NestJS to implement the API, and Nx to orchestrate it all and make code sample simpler._

### Types of State

A typical web application has the following six types of state:

- Server state
- Persistent state
- The URL and router state
- Client state
- Transient client state
- Local UI state

Let’s examine them in detail.

**The server state is stored, unsurprisingly, on the server and is provided via, for example, a REST or GraphQL endpoint. The persistent state is a subset of the server state stored on the client, in memory.** Naively, we can treat the persistent state as a cache of the server state. In real applications though this doesn’t work as we often want to apply optimistic updates to provide a better user experience.

**The client state is not stored on the server.** A good example is the filters used to create a list of items displayed to the user. The items themselves are stored in some database on the server, but the values of the filters are not.

> Recommendation: It’s a good practice to reflect both the persistent and client state in the URL.

**Applications often have state that is stored on the client, but is not represented in the URL.** For instance, YouTube remembers where I stopped the video. So next time I start watching it, it will resume the video from that moment. Since this information is not stored in the URL, if I pass a link to someone else, they will start watching from the beginning. **This is transient client state.**

**Finally, individual components can have local state governing small aspects of their behavior.** Should a zippy be expanded? What should be the color of a button? **This is local UI state.**

> Recommendation: When identifying the type of state, ask yourself the following questions: Can it be shared? What is its lifetime.

## State Synchronization

**The persistent state and the server state store the same information. So do the client state and the URL. Because of this we have to synchronize them.** And the choice of the synchronization strategy is one of the most important decisions we make when designing the state management of our applications.

Can we make some of this synchronization synchronous? What has to be asynchronous? Or using the distributed systems terminology: should we use strict or eventual consistency?

These, among others, are the questions we are going to explore in this article.

![](/blog/images/2017-07-06/1*P69nsWKWBfrYghKyo3oNZw.avif)

## Example

Let’s start with an example of what seems to be a reasonably built system. This is an application that shows a list of talks that the user can filter, watch, and rate.

![](/blog/images/2017-07-06/1*AX2vLAGb031J5K3fqyu3Sg.avif)
![](/blog/images/2017-07-06/1*lAoGSua_-txZI-WCgvYsIA.avif)

The application has two main routes: one that displays a list of talks, and the other one showing detailed information about each talk.

This is a rough sketch of this application’s architecture.

![](/blog/images/2017-07-06/1*Js5ZbjpajSvHAtkG7lkaOg.avif)

This is the application’s model.

And these are the two main components.

Both the components do not do any actual work themselves, and instead delegate to _Backend_ and _WatchService_.

Any time the filters change, _Backend_ will refetch the array of talks. So when the user navigates to an individual talk, _Backend_ will have the needed information in memory.

The implementation of _WatchService_ is very simple.

### Source Code

You can find the source code of the application [here](https://github.com/nrwl/ngrx-example/tree/d6186f9d9d912810d6d2ad317f51ecc80556bdc7).

## Types of State

Let’s see what manages each type of state.

- _Backend_ manages the persistent state (the talks) and the client state (the filters).
- The router manages the URL and the router state.
- _WatchService_ manages the transient client state (watched talks).
- The individual components manage the local UI state.

## Problems

At a first sight, the implementation looks reasonable: the application logic is handled in the services, the methods are small, and the code looks well-written. But if we look deeper, we will find a lot of problems.

### Syncing Persistent and Server State

First, when loading a talk’s details, we call _Backend.findTalk_, which reads the data from the in-memory collection. This works when the user starts with the list view and then navigates around. If the user, however, initially loads the talk details URL, the collection will be empty, and the application will fail. We can workaround it by checking if the collection has the right talk, and if it does not, fetching the information about that talk from the server.

Second, the rate method optimistically updates the passed-in talk object to get a better user experience. The problem is that it doesn’t handle errors: if the server fails to update the talk, the client will show incorrect information. Let’s fix it by resetting the rating to _null_.

After these changes, the persistent state and the server state are synced properly.

### Syncing URL and Client State

We can also see that changing the filters doesn’t update the URL. We can fix it by manually syncing the two.

![](/blog/images/2017-07-06/1*gVX7tqXOKSPP4cFW7HBmTQ.avif)

Technically this works (the URL and the client state are in sync), but this solution is problematic.

- We call _Backend.refetch_ twice. A filter change runs refetch. But it also causes a navigation that will eventually result in another refetch.
- We synchronize the router and _Backend_ asynchronously. This means that the router cannot reliability get any information from Backend. Similarly, _Backend_ cannot reliability get anything from the router or the URL — it just may not be there.
- We do not handle the case when a router guard blocks navigation. We would update the client state regardless, as if the navigation succeeded.
- Our solution is ad-hoc. We managed to synchronize the router and Backend for this particular route. If we added a new one, we would have to duplicate the logic.
- Finally, our model is mutable. This means that we can update it without updating the URL. This is a common source of errors.

## Mistakes

This is a tiny application, and we found so many problems with it. Why was it so hard? What mistakes did we make?

- **We did not separate the state management from the computation and services.** _Backend_ talks to the server, and also manages state. Same goes for _WatchService_.
- **We did not clearly define the synchronization strategy of the persistent state and the server.** Even after our changes, the solution seems ad-hoc and not holistic.
- **We did not clearly define the synchronization strategy of the client state and the URL.** Since there are no guards and refetch is idempotent, our fix worked, but it is not a sustainable solution.
- **Our model is mutable**, which makes ensuring any sort of guarantees difficult.

### Source Code

You can find the source code of this step [here](https://github.com/nrwl/ngrx-example/tree/f35777280ec587150c76ee98d06dfbb674534221).

## Introducing NgRx

Now, let’s fix these issues in a more holistic way, and to do so let’s refactor our application to use NgRx. I won’t explain NgRx in this article as there is a lot of information about it online already.

In this post, I’m going to use the new action creators syntax (read more about it [here](https://blog.angularindepth.com/ngrx-action-creators-redesigned-d396960e46da)), but all the points I’ll make will apply to the old syntax as well.

## Defining All Building Blocks

We shall start with defining all the actions our application can perform.

**Next, the effects class.**

Effects classes are where we fetch data, update local storage, and perform other side effects.

**Then, the reducer.**

Reducer functions are where we manipulate non-local state. We are going to look the reducer function itself later in this post. But for now let’s examine other things in this file.

`TalksState` defines the schema of the talks feature. If you aren’t familiar with NgRx entity (you can learn about it [here](https://blog.angular-university.io/ngrx-entity/)), the actual schema looks like this:

Real applications have multiple NgRx slices (domains). That’s why we don’t want `Store<TalksState>`. If we do that, we won’t be able to add another entity (say blogs). What we want instead is `Store<{talks: TalksState}>` . This is what `TalksPartialState` is for.

With this setup, we can add as many NgRx slices as we want, and we can also precisely type the store. (e.g, `Store<TalksPartialState&BlogsPartialState>` ).

Finally, let’s wire everything up in the application module.

### Generating NgRx and Nx

If you haven’t used NgRx, setting it all up can be a bit intimidating. Thankfully there a few tools that make it easier. In this post, we use Nx, which comes with first-class NgRx support. Simply run `ng g ngrx talks` and you will get most of it set up for you.

Learn more about it [here](https://nx.dev/angular/guides/misc-ngrx).

## Fixing Router and Client-State Synchronization

The first problem we will tackle is the synchronization of the persistent state with the server state and the client state with the URL. And to do that we need to rethink how we interact with the router.

Let’s look the issues with the current design once more:

- If the router needs some information from _Backend_, it cannot reliably get it.
- If _Backend_ needs something from the router or the URL, it cannot reliably get it.
- If a router guard rejects navigation, the client state would be updated as if the navigation succeeded.
- The synchronization is ad-hoc. If we add a new route, we will have to reimplement the synchronization code there as well.

## Router as the Source of Truth

There are many ways to approach the synchronization of the @ngrx/Store and the router. One way is to build a generic library synchronizing the store with the router. It won’t solve all of the problems, but at least the synchronization won’t be ad-hoc. Another way is to make navigation part of updating the store. And finally we can make updating the store part of navigation. Which one should we pick?

Since the user can always interact with the URL directly, we should treat the router as the source of truth and the initiator of actions. In other words, the router should invoke the reducer, not the other way around.

> Rule 1: Always treat Router as the source of truth

In this arrangement, the router parses the URL and creates a router state snapshot. It then invokes the reducer with the snapshot, and only after the reducer is done it proceeds with the navigation.

![](/blog/images/2017-07-06/1*DA3qS6E0TXfwsRSJGnwnNw.avif)

And that’s what _StoreRouterConnectingModule_ does. It will set up the router in such a way that right after the URL gets parsed and the future router state gets created, the router will dispatch a _RouterAction_. Now we just need to handle this action in _TalksEffects_.

Let me walk you through it step by step.

`DataPersistence` is a utility provided by Nx, which makes writing effects dealing with the router and server communication simpler.

Here, we are using it to create an effect that runs when the user navigates to any route rendering `TalksAndFiltersComponent` .

The `navigation` RxJS operator does the following three things:

- It filters all actions of type `RouterNavigation` that contain `TalksAndFiltersComponent` .
- It executes the run callback for each of those navigation, and it does it in a synchronized fashion to avoid race conditions. In this case, we make a request to the backend, and then map the response to a _talksUpdated_ action.
- It invokes the `onError` callback if one of the `run` calls fails.

[See here](https://github.com/nrwl/nx/blob/master/packages/angular/src/runtime/nx/data-persistence.ts#L99) to understand how `navigation` works.

### Handling talksUpdated in the Reducer

Since _TalksEffects_ is handling our data fetching, what’s left is to create a new state object in the reducer.

The `createReducer` takes the initial state and a set of handlers. Each handler takes an action creator and a reducer for that action. If you haven’t seen this way of writing reducers before, it’s analogous to this:

We are using NgRx entity to implement the reducer. Learn more [here](https://blog.angular-university.io/ngrx-entity/).

## Analysis

- The reducer can reliably use the new URL and the new router state in its calculations.
- Router guards and resolvers can use the new state created by the reducer, again reliably.
- The solution is also holistic: it is done once. We don’t need to worry about syncing the two states when introducing new routes.

## Handling Optimistic Updates

Previously, we had an ad-hoc strategy for handling optimistic updates. We can do better than that.

Let’s introduce a separate action called _unrate_, to handle the case when the server rejects and update.

Once again, we are using Nx helper to implement this effect.

Now, we just need to handle the _rate_ and _unrate_ actions in our reducer.

> Rule 2: Optimistic updates require separate actions to deal with errors.

## Immutable Data

Note, we changed our model to be immutable. This has a lot of positive consequences.

> Rule 3: Use immutable data for persistent and client state

## Updated Components

This refactoring simplified our components. Now they only query the state and dispatch actions.

## Updated Services

After these changes, both _Backend_ and _WatchService_ became stateless.

## Analysis

- **State management and computation/services are separated. The reducer is the only place where we manipulate non-local state.** Talking to the server and watching videos are handled by stateless services.
- **We no longer use mutable objects for persistent and client state.**
- We have a new strategy for syncing the persistent state with the server. We use _unrate_ to handle errors.

To make it clear our goal was not to use NgRx. It is easy to use NgRx and still mix computation and state management, not handle errors and optimistic updates, or use mutable state. NgRx enables us to fix all of these, but it is not a panacea and not the only way to do it.

> Rule 4: NgRx should the means of achieving a goal, not the goal

Also note that we didn’t touch any local UI state during this refactoring. Because the local UI state is almost never your problem. Components can have mutable properties that no one else can touch — that’s not what we should focus our attention on.

### Source Code

You can find the final version of the application [here](https://github.com/nrwl/ngrx-example\).

## Summary

We started with a simple application. Its implementation look reasonable: the functions were small, the code looked well-written. But when we examinded it closer, we noticed a lot of problems. Many of which are not easy to notice if you don’t have a trained eye. We fixed some of them, but many still remained, and the solution was not holistic.

The application had these issues because we did not think through its state management strategy. Everything was ad-hoc. And when dealing with concurrent distributed systems, ad-hoc solutions quickly break down.

We embarked on refactoring the application. We switched to using NgRx and immutable data. This wasn’t our goal. Rather this was the means of achieving some of our goals. To solve the rest of the problems, we implemented a strategy connecting the reducer and its store to the router.

And we discovered a few useful rules on the way.

The main takeaway is you should be deliberate about how you manage state. It is a hard problem, and hence it requires careful thinking. Do not trust anyone saying they have “one simple pattern/library” fixing it — that’s never the case.

Decide on the types of state, how to manage them, and how to make sure the state is consistent. Be intentional about your design.

## Appendix: On “boilerplate”

A common complain about NgRx is that it creates some boilerplate. This is partially true. It’s because the core of NgRx is very small, which is great as it gives you a lot of flexibility. The downside of this is that you have to do a few things yourself.

In this post I wanted to show that if you add a handful of utilities, the amount of code you need to write shrinks, and the code becomes more straightforward. Even though it takes time to learn them, the payoff is worth it. Take a look:

- [NgRx Entity](https://blog.angular-university.io/ngrx-entity/) is a great way to manage immutable collections.
- [Creator functions](https://medium.com/ngrx/announcing-ngrx-version-8-ngrx-data-create-functions-runtime-checks-and-mock-selectors-a44fac112627) reduce boilerpate.
- [Nx](https://nx.dev/angular) is a set of extensible dev tools for monorepos that extends the Angular CLI. Nx comes with a set of utilities that help writing effects dealing with the router and server communication simpler

### Victor Savkin is a co-founder of [Nrwl](https://nrwl.io). We help companies develop like Google since 2016. We provide consulting, engineering and tools.

![](/blog/images/2017-07-06/0*4HpWdaQEPIQr1EDw.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._

![](/blog/images/2017-07-06/1*pbElIZt9YeORNw8m142z6w.avif)
