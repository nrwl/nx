# Nrwl Extensions for Angular

NX (Nrwl Extensions) is a set of libraries and schematics for the Angular framework.

## Installing

Add the following dependencies to your project's `package.json` and run `npm install`:

```
{
  dependencies: {
    "@ngrx/store": "4.0.2",
    "@ngrx/effects": "4.0.2",
    "@nrwl/nx": "https://github.com/nrwl/nx-build" 
  }
}
```



## Schematics

### addNgRxToModule

#### Root

Run `schematics @nrwl/nx:addNgRxToModule --module=src/app/app.module.ts  --root`, and you will see the following files created:

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

#### EmptyRoot

Run `schematics @nrwl/nx:addNgRxToModule --module=src/app/app.module.ts  --emptyRoot` to only add the `StoreModule.forRoot` and `EffectsModule.forRoot` calls.

#### Feature

Run `schematics @nrwl/nx:addNgRxToModule --module=src/app/mymodule/mymodule.module.ts `, and you will see the following files created:

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

#### skipImport

Add `--skipImport` to generate files without adding imports to the module.



## Testing

Nrwl Extensions come with utilities to simplify testing Angular applications. See `app.effects.spec.ts`. Read https://github.com/vsavkin/testing_ngrx_effects for more information.


