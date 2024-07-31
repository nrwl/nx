---
title: 'Angular Forms in Depth'
slug: 'angular-forms-in-depth'
authors: ['Victor Savkin']
cover_image: '/blog/images/2017-02-24/1*mF3ulz7qZCuJPD0PATCSng.png'
tags: [nx, release]
---

_Victor Savkin is a co-founder of_ [_nrwl.io_](https://goo.gl/v4nh0p)_, providing Angular consulting to enterprise teams. He was previously on the Angular core team at Google, and built the dependency injection, change detection, forms, and router modules._

Web applications heavily rely on forms. In many ways Angular is so successful because two-way bindings and _ng-model_ made creating dynamic forms easy.

Although very flexible, the AngularJS 1.x approach has some issues: the data flow in complex user interactions is hard to understand and debug.

Angular 2.x+ builds up on the ideas from AngularJS 1.x: it preserves the ease of creating dynamic forms, but avoids the issues making data flow hard to understand.

In this article we will look at how form handling (or input handling) works in Angular.

## Read the Series

This is the seventh post in the Essential Angular series, which aims to be a short, but at the same time, fairly complete overview of the key aspects of Angular.

- [Essential Angular. Part 1: Compilation](https://medium.com/essential-angular-2-compilation-cfbebf9bb6e4#.y9s7pc41m)
- [Essential Angular. Part 2: NgModules](https://medium.com/essential-angular-ngmodules-16474ea99713#.5y73lcqde)
- [Essential Angular. Part 3: Components and Directives](https://medium.com/essential-angular-components-and-directives-ab65172ba60#.47zn86pdl)
- [Essential Angular. Part 4: Dependency Injection](https://medium.com/essential-angular-dependency-injection-a6b9dcca1761#.opd2cg9wk)
- [Essential Angular. Part 5: Change Detection](https://medium.com/essential-angular-change-detection-fe0e868dcc00#.isq09mg9b)
- [Essential Angular. Part 6: Testing](https://medium.com/essential-angular-testing-192315f8be9b#.gdzmcppoh)

**You can also check out** [**the Essential Angular book**](https://gumroad.com/l/essential_angular)**, which has extra content not available on this blog.**

## Example App

Throughout this series I use the same application in the examples. This application is a list of tech talks that you can filter, watch, and rate.

![](/blog/images/2017-02-24/1*Vjih_NbJCX6bzORavaL8qg.avif)

You can find the source code of the application [here](https://github.com/vsavkin/essential-angular-book-app).

## Two Modules

In AngularJS 1.x, the _ng-model_ directive was baked into the core framework. This is no longer the case. The [_@angular/core_](http://twitter.com/angular/core) package doesn’t contain a form-handling library. It only provides the key primitives we can use to build one.

Of course, making everyone to build their own would not be practical. And that’s why the Angular team built the [_@angular/forms_](http://twitter.com/angular/forms) package with two modules: _FormsModule_ and _ReactiveFormsModule_.

- _FormsModule_ implements AngularJS-style form handling. We create a form by placing directives in the template. We then use data bindings get data in and out of that form.
- _ReactiveFormsModule_ is another take on handling input, where we define a form in the component class and just bind it to elements in the template. We tend to use reactive programming to get data in and out of the form, hence the name “reactive”.

At first glance, these two modules seem very different. But once we understand the underlying mechanisms, we will see how much they have in common. In addition, it will give us an idea of how to build our own form-handling module if needed.

## High-Level Overview

![](/blog/images/2017-02-24/1*BCmfpKyuZZcnApDEFyglbQ.avif)

### App Model

**The app model is an object provided by the application developer.** It can be a JSON object fetched from the server, or some object constructed on the client side. Angular doesn’t make any assumptions about it.

### Form Model

**The form model is a UI-independent representation of a form. It consists of three building blocks: _FormControl_, _FormGroup_, and _FormArray_.** We will look at the form model in detail later in this chapter. Both _FormsModule_ and _ReactiveFormsModule_ use this model.

### Form Directives

**These are the directives connecting the form model to the DOM** (e.g., _NgModel_). _FormsModule_ and _ReactiveFormsModule_ provide different sets of these directives.

### DOM

These are ours inputs, checkboxes, and radio buttons.

## Form Model

![](/blog/images/2017-02-24/1*nmISCjF4gwdp8x0qqbfsWw.avif)

To make form handling less UI-dependent, [_@angular/forms_](http://twitter.com/angular/forms) provides a set of primitives for modelling forms: _FormControl_, _FormGroup_, and _FormArray_.

### Form Control

**_FormControl_ is an indivisible part of the form, an atom.** It usually corresponds to a simple UI element, such as an input.

A _FormControl_ has a value, status, and a map of errors:

### Form Group

_FormGroup_ is a fixed-size collection of controls, a record.

**A _FormGroup_ is itself a control**, and, as such, has the same methods as _FormControl_.

The value of a group is just an aggregation of the values of its children. Any time the value of a child control changes, the value of the group will change as well.

In opposite to the value, the form group doesn’t aggregate the errors of its children. It has its own validators and its own collection of errors.

**The status of a group is calculated as follows:**

- If one of its children is invalid, the group is invalid.
- If all of its children are valid, but the group itself has errors, the group is invalid.
- If all of its children are valid, and the group has no errors, the group is valid.

Since a form group acts like a control, we can nest form groups in arbitrary ways.

### Form Array

**Whereas _FormGroup_ is a collection of different control types of fixed length, _FormArray_ is a collection of the same control type of a variable length.**

All the considerations regarding _FormGroup_’s value, status, and errors apply here as well.

### Updating Form Model

There are two ways to update the value of a form: _setValue_ and _patchValue_:

The _setValue_ method is strict and requires the value to match the structure of the form.

If we try to set the value of a control that doesn’t exist, or if we exclude the value of a control, _setValue_ will fail.

The _patchValue_ method works as _setValue_ except that it doesn’t throw when the value is a superset or a subset of the form.

By default updating a _control_ will update its parents. We can prevent the change from propagating through the parents by passing _onlySelf: true_:

### Disabling Form Model

This exempts _acceptTerms_ validation checks and excludes it from the aggregate value of any parent. Its status gets set to _DISABLED_.

### Async Validations

The _required_ validator we have used throughout the chapter is synchronous. The moment we set value, the moment the control goes into the _VALID_ or _INVALID_ state. Some validations, however, have to be asynchronous. A good example is the uniqueness of the login.

This will set the status of the control and its parents to _PENDING_. And, once the promise returned by _uniqLoginValidator_ resolves, the status will be set to either _INVALID_ or _VALID_.

In addition to declarative validators, we can always set the errors on the control imperatively.

### Composing Validators

A validator is just a function that takes a control and returns a map of errors.

The value doesn’t have to be a boolean. We can provide extra information to create a more meaningful error message.

Since the return value of a validator is a _map_, and not a single value, it’s easy to compose multiple validators into one.

The provided _compose_ function will execute all the validators and merge the errors. We can, of course, implement our own compose function that, for instance, will execute validators until the first failure.

### Listening to Changes

**Any time a control updates, it will emit the value.**

As you can see the value of the form has been updated twice. We can prevent this by setting the value on the form itself.

We can also prevent the events from being emitted altogether by passing _emitEvent: false_.

### Power of RxJS

Since _valueChanges_ and _statusChanges_ are RxJS observables, we can use the rich set of RxJS combinators to implement powerful user interactions in a just a few lines of code.

### Why Form Model?

The form model is a UI-independent way to represent user input comprising simple controls (_FormControl_) and their combinations (_FormGroup_ and _FormArray_), where:

- Each control has a value.
- Each control has a status.
- Each control has validators and errors.
- Each control can be disabled.
- Each control emits events.

**Having this model has the following advantages:**

- Form handling is a complex problem. Splitting it into UI-independent and UI-dependent parts makes them easier to manage.
- We can test form handling without rendering UI.
- Having the form model makes reactive forms possible (see below).

## Form Directives

Abstractly describing input is all well and good, but at some point we will need to connect it to the UI.

![](/blog/images/2017-02-24/1*S5Eu9KBSzy8sSowr5gzD7w.avif)

[_@angular/forms_](http://twitter.com/angular/forms) provides two modules that do that: _FormsModule_ and _ReactiveFormsModule_.

### ReactiveFormsModule

![](/blog/images/2017-02-24/1*KihLAKMYIIA7f5DphahX5A.avif)

_ReactiveFormsModule_ is simpler to understand and explain than _FormsModule_. That’s why I will cover it first.

There are a few things here to note.

**First, we import _ReactiveFormsModule_**, which provides, among others, the _formGroup_ and _formControlName_ directives.

**Second, we manually construct a form model.**

**Third, we bind the constructed form to the _div_ using _formGroup_.** Then we use _formControlName_ to bind the _title_, _speaker_, and _highRating_ to the three inputs. The _name_ suffix indicates that we need to pass the name of a field of the containing group.

**When using _ReactiveFormsModule_ we are responsible for creating the form model. We use the directives merely to bind the form to elements in the UI.**

Then we use the constructed form model directly to synchronize it with the client model or trigger events. And we often do it by subscribing to the _valueChanges_ and _statusChanges_ observables.

### FormsModule

![](/blog/images/2017-02-24/1*QskzNGT_wAu5VP2c9zOvBw.avif)

_FormsModule_ implements AngularJS-style forms.

**This is similar to AngularJS 1.x.** We use the _\[()\]_ syntax to bind the _speaker_, _title_, and _highRating_ properties of the filters component to the three inputs. We then invoke the _applyFilters_ method when the user submits the form.

Even though it’s not seen in the example, the following form group still gets created:

The difference is that it does not get created by the application developer, but by the _NgModel_ and _NgForm_ directives.

- The _NgForm_ directive gets instantiated at _<form (submit)=”applyFilters()”>._ This directive creates an empty _FormGroup_.
- The _NgModel_ directive gets instantiated at _<input \[(ngModel)\]=”speaker” name=”speaker” placeholder=”Speaker”>_. This directive creates a \`FormControl\` and adds it to the _FormGroup_ created by the encompassing _NgForm_.

**How is it possible?**

If you have read the chapter on change detection carefully, you probably wonder how this works. Shouldn’t the following fail?

If _NgModel_ and _NgForm_ were implemented naively, the _{{f.controls.speaker == null}}_ binding would evaluate to _true_ the first time, when the group is empty, and will evaluate to _false_ once _NgModel_s add their form controls to the group. This change from \_true_ to _false_ will happen within a change detection run, which, in opposite to AngularJS 1.x, is disallowed in Angular 2.x+. **The value of a binding can change only between change detection runs.**

**To make it work, _NgModel_ doesn’t add a form control synchronously — it does it in a microtask.** In the example above, the three _ngModels_ will schedule three microtasks to add the _speaker_, _title_, and _highRating_ controls.

During the first change detection run, the form will always be empty and _{{f.controls.speaker == null}}_ will always evaluate to _true_. Then, after the three microtasks, Angular will run change detection again, and _{{f.controls.speaker == null}}_ will evaluate to _false_.

This is how we can preserve all the guarantees of Angular 2.x+ and still make the API feel AngularJS-like.

### Accessing Form Model When Using FormsModule

We can still access the form model by either querying for the _NgForm_ directive or by referencing it in the template.

Once we get the model, we can interact with it imperatively or subscribe to its observables.

## The DOM

![](/blog/images/2017-02-24/1*BzPYUuyuZvipVr8dEbB42A.avif)

The _ngModel_, _ngControlName_ and other form directives bind the form model to UI elements, which are often native to the platform (e.g., _<input>_), but they do not have to be. For instance, _NgModel_ can be applied to an Angular component.

**A _ControlValueAccessor_ is a directive that acts like a adapter connecting a UI element to _NgModel_.** It knows how to read and write to the native UI-element.

The [_@angular/forms_](http://twitter.com/angular/forms) package comes with value accessors for all built-in UI elements (input, textarea, etc). But if we want to apply an NgModel to a custom element or an Angular component, we will have to provide a value accessor for it ourselves.

## Wrapping Up

Form handling is a complex problem. One of the main reasons AngularJS got so successful is that two-way bindings and _ng-model_ provided a good solution for it.

But there were some downsides, mainly complex forms built with _ng-model_ made the data flow of the application hard to follow and debug. Angular 2.x+ builds up on the ideas from Angular 1, but avoids its problems.

_NgModel_ and friends are no longer part of the core framework. The [_@angular/core_](http://twitter.com/angular/core) package only contains the primitives we can use to build a form-handling module. Instead, Angular has a separate package — [_@angular/forms_](http://twitter.com/angular/forms)— that comes with _FormsModule_ and _ReactiveFormsModule_ that provide two different styles of handling user input.

Both the modules depend on the form model consisting of _FormControl_, _FormGroup_, and _FormArray_. Having this UI-independent model, we can model and test input handling without rendering any components.

Finally, [_@angular/forms_](http://twitter.com/angular/forms) comes with a set of directives to handle build-in UI elements (such as _<input>_), but we can provide our own.

## Essential Angular Book

This article is based on the Essential Angular book, which you can find here [https://leanpub.com/essential_angular](https://leanpub.com/essential_angular). If you enjoy the article, check out the book!

### Victor Savkin is a co-founder of [Nrwl](https://nrwl.io). We help companies develop like Google since 2016. We provide consulting, engineering and tools.

![](/blog/images/2017-02-24/0*4HpWdaQEPIQr1EDw.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
