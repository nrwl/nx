# Setting Up NgRx

Leveraging [NgRx](https://github.com/ngrx/platform) for state management in an Angular application involves

- planning out the root state and any feature states.
- setup of files for NgRx actions, reducers, selectors, and effects.
- preparation of testing `*.spec.*` files.
- updates to library or application modules to register the NgRx services

> Did you know that this collection of generated files used to manage the NgRx state are often referred to as 'NgRx' boilerplate?

## Overview

You use this Nx schematic to build out a new NgRx feature area that provides a new slice of managed state.

**@nrwl/angular** has an `ngrx` schematic to generate files that implement best patterns for NgRx scaffolding. This schematic generates source files and then enhances the generated NgRx boilerplate with Nx improvements.

The `ngrx` schematic generates a NgRx feature set containing the following files:

- `actions`,
- `reducer`,
- `effects`,
- `selectors`, and
- `facade` (optional)

## Terminal Command

**`ngrx`** _&lt;name&gt; &nbsp; --module="" &nbsp; [options]_

> Note: the `name` and the `--module=` arguments are required!

You can generate new **feature** state (NgRx files) which are registered with the `StoreModule.forFeature()` in the feature library NgModule OR the `StoreModule.forRoot()` in the application ngModule.

> Feature state libraries can be lazy loaded and support feature state slices that are independent of other feature states.

```bash
ng g @nrwl/angular:ngrx <FeatureName> --module=<module> [options]
```

Before you start generating your files, let's first review the schematic options:

## ngrx Schematic Options

- `name` : Specifies the name of the NgRx feature (required)
- `module` : Specifies the parent directory for the NgRx folder (required)

* `facade` : Specifies to generate an associated Facade class with the NgRx files
* `directory` : Specifies the name of the grouping folder for the NgRx files
* `root` : Add StoreModule.forRoot and EffectsModule.forRoot instead of forFeature
* `onlyAddFiles` : Only add new NgRx files, without changing the module file
* `onlyEmptyRoot` : Do not generate any files. Only generate StoreModule.forRoot and EffectsModule.forRoot
* `skipPackageJson` : Do not add NgRx dependencies to package.json

Let's first walk through how we can use Nx `ngrx` schematic to get started with NgRx in an Angular application by setting up the root level store and corresponding files. Then we will take a look at how we can add feature level store segments as our application grows, ensuring that our code follows a common pattern each time.

<br/>

#### 1) `name`

Specifies the name of the NgRx feature (e.g., Products, Users, etc.).

- `name`
  - Type: `string`
  - Required: true

* Do not use `State` a suffix.
* We recommend developers use the plural forms for feature 'name'; e.g. Products, Users, Cars, etc.

```bash
ng g @nrwl/angular:ngrx <FeatureName> [options]
```

#### 2) `module`

Specifies the path to Angular `NgModule`. This option is **always** required and is used to determine the **parent directory** for the new **+state** folder.

- `--module`
  - Type: `string`
  - Required: true

```bash
ng g @nrwl/angular:ngrx <FeatureName> --module=<xxx> [options]
```

- Another option can specify an application root module when the `--root` is specified. The NgRx state files are registered with the `StoreModule.forRoot()` in the application module.
  > e.g. --module=apps/myapp/src/app/app.module.ts --root
- Otherwise, this option can specify a library module. The parent folder to this module will also be used as the _container_ library for the new NgRx state files. Consider the following example of a feature library `state` used for _comments_... organized within a _comments_ grouping folder.

  > e.g. --module=libs/comments/state/src/lib/comments-state.module.ts

#### 3) `facade`

Specify this flag to generate NgRx Facade class(es) along with the standard NgRx scaffolding.

- `--facade`
  - Type: `boolean`
  - Required: false; defaults to `false`

```bash
ng g @nrwl/angular:ngrx <FeatureName> --module=<xxx> --facade [options]
```

> See the blog [Better State Management with Facades](https://blog.nrwl.io/nrwl-nx-6-2-angular-6-1-and-better-state-management-e139da2cd074#cb93) for details.

#### 4) `directory`

Specifies the name of the grouping folder used to contain the feature ngrx files: `<feature>.reducer.ts`, `<feature>.effects.ts`, `<feature>.selectors.ts`, `<feature>.actions.ts`. If not specified, a default folder named `+state` will be used to group the files.

> Since this `+state` folder is within a library folder, the required `--module` option indicates **which** library will contain the new state files.

- `--directory`
  - Type: `string`
  - Default: `+state`

<br/>

---

### Root

Making use of the Angular CLI ng generate command, we can use the ngrx schematic to scaffold out the following in our applications:

- Root level NgRx configuration
- Feature level NgRx configuration

##### Option) `root`

Getting up and running with ngrx starts with creating a store at the root level of the application.

We can run the generate command for ngrx with the module and root options to create a new root level store and corresponding pieces needed:

- `--root`
  - Type: `boolean`
  - Required: false; defaults to `false`

```bash
ng g @nrwl/angular:ngrx app --module=apps/<appname>/src/app/app.module.ts  --root
```

We will see the following files created:

```console
apps/<appname>/src/app/+state/app.actions.ts
apps/<appname>/src/app/+state/app.effects.ts
apps/<appname>/src/app/+state/app.effects.spec.ts
apps/<appname>/src/app/+state/app.reducer.ts
apps/<appname>/src/app/+state/app.reducer.spec.ts
```

Also, app.module.ts will have StoreModule.forRoot and EffectsModule.forRoot configured.

##### Option) `onlyEmptyRoot`

We can run the generate command for ngrx with the module and onlyEmptyRoot option to only add the StoreModule.forRoot and EffectsModule.forRoot calls without generating any new files.

```bash
ng g @nrwl/angular:ngrx app --module=apps/<appname>/src/app/app.module.ts  --onlyEmptyRoot
```

This can be useful in the cases where we don't have a need for any state at the root (or app) level.

### Feature

We can run the generate command for ngrx with the module option to create a new feature level store and corresponding pieces needed:

```bash
ng g @nrwl/angular:ngrx products --module=libs/<libname>/src/mymodule.module.ts
```

We will see the following files created:

```console
libs/<libname>/src/+state/products.actions.ts
libs/<libname>/src/+state/products.effects.ts
libs/<libname>/src/+state/products.effects.spec.ts
libs/<libname>/src/+state/products.reducer.ts
libs/<libname>/src/+state/products.reducer.spec.ts
```

Also, mymodule.module.ts will have StoreModule.forFeature and EffectsModule.forFeature configured

#### Option) `onlyAddFiles`

We can run the generate command for ngrx with the module and `--onlyAddFiles` option to generate files without adding imports to the module.

```console
ng g @nrwl/angular:ngrx products --module=apps/<appname>/src/app/mymodule/mymodule.module.ts --onlyAddFiles
```

This can be useful when we want to start building out our state without wiring it up to our Angular application yet.

<br/>
  
----

## Learn by Example

Consider a command to generate a `Comments` NgRx feature set and register it within an application root ngModule.

```bash
ng g @nrwl/angular:ngrx Comments --root --module=apps/myapp/src/app/app.module.ts
```

> This would use `StoreModule.forRoot()` to register the Comments NgRx state functionality.

<br/>

Better yet, let's generate a `Comments` feature set within a `state` library and register it with the `comments-state.module.ts` file in the same `comments/state` folder.

```bash
ng g @nrwl/angular:ngrx Comments --module=libs/comments/state/src/lib/comments-state.module.ts
```

#### Generated Files

The files generated are shown below and include placeholders for the _comments_ state.

> The Comments notation used be below indicates a placeholder for the actual _comments_ name.

- [comments.actions.ts](#commentsactionsts)
- [comments.reducer.ts](#commentsreducerts)
- [comments.selectors.ts](#commentsselectorsts)
- [comments.effects.ts](#commentseffectsts)
- [../app.module.ts](#appmodulets) or [../comments-state.module.ts](#commentsstatemodulets)

<br/>

###### comments.actions.ts

```typescript
import { Action } from '@ngrx/store';

export enum CommentsActionTypes {
  LoadComments = '[Comments] Load Comments',
  CommentsLoaded = '[Comments] Comments Loaded',
  CommentsLoadError = '[Comments] Comments Load Error'
}

export class LoadComments implements Action {
  readonly type = CommentsActionTypes.LoadComments;
}

export class CommentsLoadError implements Action {
  readonly type = CommentsActionTypes.LoadComments;
}

export class CommentsLoaded implements Action {
  readonly type = CommentsActionTypes.CommentsLoaded;
  constructor(public payload: any[]) {}
}

export type CommentsAction = LoadComments | CommentsLoaded | CommentsLoadError;

export const fromCommentsActions = {
  LoadComments,
  CommentsLoaded,
  CommentsLoadError
};
```

###### comments.selectors.ts

```typescript
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { CommentsState } from './comments.reducer';

const getCommentsState = createFeatureSelector<FeatureState>('CommentsState');
const getLoaded = createSelector( getCommentsState, (state:CommentsState) => return state.loaded );
const getSelectedId = createSelector( getCommentsState, (state:CommentsState) => return state.selectedId );

const getAllComments = createSelector( getCommentsState, getLoaded, (state:CommentsState, isLoaded) => {
  return isLoaded ? state.list : [ ];
});
const getSelectedComments = createSelector( getAllComments, getSelectedId, (list, id) => {
    let comments = list.find(it => it.id == id);
    return comments ? Object.assign({}, comments) : undefined;
});

export const commentsQuery = {
  getLoaded,
  getAllComments,
  getSelectedComments
}
```

###### comments.reducer.ts

```typescript
import { CommentsAction, CommentsActionTypes } from './comments.actions';
import { Comments, CommentsState } from './comments.reducer';

/**
 * Interface for the 'Comments' data used in
 *  - CommentsState, and
 *  - commentsReducer
 */

export interface Entity {}

export interface CommentsState {
  list: Entity[]; // analogous to a sql normalized table
  loaded: boolean; // has the Comments list been loaded ?
  selectId?: string | number; // which Comments record has been selected
  error?: any; // last none error (if any)
}

export const initialState: CommentsState = {
  list: [],
  loaded: false
};

export function commentsReducer(
  state: CommentsState = initialState,
  action: CommentsAction
): CommentsState {
  switch (action.type) {
    case CommentsActionTypes.CommentsLoaded: {
      state = {
        ...state,
        list: action.payload,
        loaded: true
      };
      break;
    }
  }
  return state;
}
```

###### comments.effects.ts

```typescript
import { Injectable } from '@angular/core';
import { Effect, Actions } from '@ngrx/effects';
import { DataPersistence } from '@nrwl/angular';

import { CommentsState } from './comments.reducer';
import {
  CommentsLoadError,
  CommentsLoaded,
  CommentsActionTypes
} from './comments.actions';

@Injectable()
export class CommentsEffects {
  @Effect()
  loadComments$ = this.dataPersistence.fetch(CommentsActionTypes.LoadComments, {
    run: (action: LoadComments, state: CommentsState) => {
      // Your custom REST 'load' logic goes here. For now just return an empty list...
      return new CommentsLoaded([]);
    },

    onError: (action: LoadComments, error) => {
      console.error('Error', error);
      return new CommentsLoadError(error);
    }
  });

  constructor(
    private actions: Actions,
    private dataPersistence: DataPersistence<Comments>
  ) {}
}
```

<br/>

---

#### Registering your NgRx state as _Root_

If you are register the Comments NgRx as part of the `.forRoot()` state, then:
e.g.

```bash
ng g @nrwl/angular:ngrx Comments --root --module=apps/myapp/src/app/app.module.ts
```

will update the root ngModule with NgRx configurations:

<br/>
 
###### apps/myapp/src/app/app.module.ts

```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { environment } from '../environments/environment';
import { StoreRouterConnectingModule } from '@ngrx/router-store';
import { storeFreeze } from 'NgRx-store-freeze';

import {
  commentsReducer,
  CommentsState,
  initialState,
  CommentsEffects
} from '<npmScope>/comments';

@NgModule({
  imports: [
    BrowserModule,
    RouterModule.forRoot([]),
    StoreModule.forRoot(
      { comments: commentsReducer },
      {
        initialState: { comments: commentsInitialState },
        metaReducers: !environment.production ? [storeFreeze] : []
      }
    ),
    EffectsModule.forRoot([CommentsEffects]),
    !environment.production ? StoreDevtoolsModule.instrument() : [],
    StoreRouterConnectingModule
  ],
  declarations: [AppComponent],
  bootstrap: [AppComponent]
})
export class AppModule {}
```

<br/>

#### Registering your NgRx state as _Feature_

Otherwise you are registering your Comments state management as a feature library. This is the recommended approach.

The command:

```bash
ng g @nrwl/angular:ngrx Comments --module=libs/comments/state/src/lib/comments-state.module.ts
```

which will update the feature library ngModule with NgRx Comments configurations as follows:

<br/>

###### libs/comments/state/src/lib/comments-state.module.ts

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

import { initialState, commentsReducer } from './+state/comments.reducer';
import { CommentsEffects } from './+state/comments.effects';

@NgModule({
  imports: [
    CommonModule,
    StoreModule.forFeature('comments', commentsReducer, { initialState }),
    EffectsModule.forFeature([CommentsEffects])
  ]
})
export class CommentsStateModule {}
```

<br/>

#### Exporting the Public API

Finally, we update the <Feature> library's barrel `index.ts` to export the updated _public API_:

- the NgRx queries (aka selectors),
- the NgRx feature reducer
- the NgRx feature ngModule

<br/>

###### libs/comments/comments-state/src/lib/index.ts

```typescript
export * from './lib/+state/comments.selectors';
export * from './lib/+state/comments.reducer';

export { CommentsStateModule } from './lib/comments-state.module';
```

<br/>
