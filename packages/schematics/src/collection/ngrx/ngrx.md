# ngrx
--------

## Overview

Generates a ngrx feature set containing an `init`, `interfaces`, `actions`, `reducer` and `effects` files. 

You use this schematic to build out a new ngrx feature area that provides a new piece of state.

## Command

```sh
ng generate ngrx FeatureName [options]
```

##### OR

```sh
ng generate f FeatureName [options]
```

### Options

Specifies the name of the ngrx feature (e.g., Products, User, etc.)

- `name`
  - Type: `string`
  - Required: true

Path to Angular Module. Also used to determine the parent directory for the new **+state** 
directory; unless the `--directory` option is used to override the dir name.

>  e.g. --module=apps/myapp/src/app/app.module.ts

- `--module`
  - Type: `string`
  - Required: true

Specifies the directory name used to nest the **ngrx** files within a folder.

- `--directory`
  - Type: `string`
  - Default: `+state`

#### Examples

Generate a `User` feature set and register it within an `Angular Module`.

```sh
ng generate ngrx User -m apps/myapp/src/app/app.module.ts
ng g ngrx Producrts -m libs/mylib/src/mylib.module.ts
```


Generate a `User` feature set within a `user` folder and register it with the `user.module.ts` file in the same `user` folder.

```sh
ng g ngrx User -m apps/myapp/src/app/app.module.ts -directory user
```

## Generated Files

The files generated are shown below and include placeholders for the *feature* name specified.

> The &lt;Feature&gt; notation used be below indicates a placeholder for the actual *feature* name.

*  [&lt;feature&gt;.actions.ts](#featureactionsts)
*  [&lt;feature&gt;.reducer.ts](#featurereducerts)
*  [&lt;feature&gt;.effects.ts](#featureeffectsts)
*  [&lt;feature&gt;.selectors.ts](#featureselectorsts)
*  [&lt;feature&gt;.facade.ts](#featurefacadests)

*  [../app.module.ts](#appmodulets)
  
#### &lt;feature&gt;.actions.ts
  
```ts
import {Action} from "@ngrx/store";

export enum <Feature>ActionTypes {
 <Feature>       = "[<Feature>] Action",
 Load<Feature>   = "[<Feature>] Load Data",
 <Feature>Loaded = "[<Feature>] Data Loaded"
}

export class <Feature> implements Action {
 readonly type = <Feature>ActionTypes.<Feature>;
}

export class Load<Feature> implements Action {
 readonly type = <Feature>ActionTypes.Load<Feature>;
 constructor(public payload: any) { }
}

export class DataLoaded implements Action {
 readonly type = <Feature>ActionTypes.<Feature>Loaded;
 constructor(public payload: any) { }
}

export type <Feature>Actions = <Feature> | Load<Feature> | <Feature>Loaded;
```

#### &lt;feature&gt;.reducer.ts
```ts
import { <Feature> } from './<feature>.interfaces';
import { <Feature>Action, <Feature>ActionTypes } from './<feature>.actions';

/**
 * Interface for the '<Feature>' data used in
 *  - <Feature>State, and
 *  - <feature>Reducer
 */
export interface <Feature>Data {

}

/**
 * Interface to the part of the Store containing <Feature>State
 * and other information related to <Feature>Data.
 */
export interface <Feature>State {
  readonly <feature>: <Feature>Data;
}

export const initialState: <Feature>Data = {  };

export function <feature>Reducer(state: <Feature>Data = initialState, action: <Feature>Actions): <Feature>Data {
 switch (action.type) {
   case <Feature>ActionTypes.<Feature>Loaded: {
     return { ...state, ...action.payload };
   }
   default: {
     return state;
   }
 }
}
```

#### &lt;feature&gt;.effects.ts
```ts
import { Injectable } from '@angular/core';
import { Effect, Actions } from '@ngrx/effects';
import { DataPersistence } from '@nrwl/nx';

import { <Feature> } from './<feature>.interfaces';
import { Load<Feature>, <Feature>Loaded, <Feature>ActionTypes } from './<feature>.actions';

@Injectable()
export class <Feature>Effects {
 @Effect() load<Feature>$ = this.dataPersistence.fetch(<Feature>ActionTypes.Load<Feature>, {
   run: (action: Load<Feature>, state: <Feature>) => {
     return new <Feature>Loaded({});
   },

   onError: (action: Load<Feature>, error) => {
     console.error('Error', error);
   }
 });

 constructor(
   private actions: Actions, 
   private dataPersistence: DataPersistence<Feature>) { }
}
```


#### ../app.module.ts
```ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import {
  <feature>Reducer,
  <Feature>State,
  <Feature>Data,
  initialState as <feature>InitialState
} from './+state/<Feature>.reducer';
import { <Feature>Effects } from './+state/<Feature>.effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { environment } from '../environments/environment';
import { StoreRouterConnectingModule } from '@ngrx/router-store';
import { storeFreeze } from 'ngrx-store-freeze';

@NgModule({
  imports: [BrowserModule, RouterModule.forRoot([]),
    StoreModule.forRoot({ <feature>: <feature>Reducer }, {
      initialState: { <feature>: <feature>InitialState },
      metaReducers: !environment.production ? [storeFreeze] : []
    }),
    EffectsModule.forRoot([<Feature>Effects]),
    !environment.production ? StoreDevtoolsModule.instrument() : [],
    StoreRouterConnectingModule],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  providers: [<Feature>Effects]
})
export class AppModule {
}

```
