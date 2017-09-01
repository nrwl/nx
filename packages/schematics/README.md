# Angular Extensions: Schematics

Nx (Angular Extensions) is a set of libraries and schematics for the Angular framework.



## Installing

Add the following dependencies to your project's `package.json` and run `npm install`:

```
{
  dependencies: {
    "@nrwl/schematics": "https://github.com/nrwl/schematics-build"
  }
}
```



## Schematics

### NgRx

#### Root

Run `schematics @nrwl/schematics:ngrx --module=src/app/app.module.ts  --root`, and you will see the following files created:

```
/src/app/+state/app.actions.ts
/src/app/+state/app.effects.ts
/src/app/+state/app.effects.spec.ts
/src/app/+state/app.init.ts
/src/app/+state/app.interfaces.ts
/src/app/+state/app.reducer.ts
/src/app/+state/app.reducer.spec.ts
```

Also, `app.module.ts` will have `StoreModule.forRoot` and `EffectsModule.forRoot` configured.

#### onlyEmptyRoot

Run `schematics @nrwl/schematics:ngrx --module=src/app/app.module.ts  --onlyEmptyRoot` to only add the `StoreModule.forRoot` and `EffectsModule.forRoot` calls without generating any new files.

#### Feature

Run `schematics @nrwl/schematics:ngrx --module=src/app/mymodule/mymodule.module.ts `, and you will see the following files created:

```
/src/app/mymodule/+state/app.actions.ts
/src/app/mymodule/+state/app.effects.ts
/src/app/mymodule/+state/app.effects.spec.ts
/src/app/mymodule/+state/app.init.ts
/src/app/mymodule/+state/app.interfaces.ts
/src/app/mymodule/+state/app.reducer.ts
/src/app/mymodule/+state/app.reducer.spec.ts
```

Also, `mymodule.module.ts` will have `StoreModule.forFeature` and `EffectsModule.forFeature` configured.

#### onlyAddFiles

Add `--onlyAddFiles` to generate files without adding imports to the module.



### upgrade-shell

Run `schematics @nrwl/schematics:upgrade-shell --module=src/app/app.module.ts --angularJsImport=legacy --angularJsCmpSelector=rootLegacyCmp` and you will see the following files created:

```
/src/app/legacy-setup.ts
/src/app/hybrid.spec.ts
```

`legacy-setup.ts` contains all the downgraded and upgraded components.

`src/app/module.ts` has been modified to bootstrap a hybrid app instead of `AppComponent`.

`/src/app/hybrid.spec.ts` contains the spec verifying that the hybrid application runs properly.

For simple scenarios, no modification is necessary in `/src/app/legacy-setup.ts`.

Open `/src/app/hybrid.spec.ts` to update the expectation in the test and run `ng test`. It should pass.
