# ngrx

Add NgRx support to a module

## Usage

```bash
ng generate ngrx ...

```

## Options

### directory

Default: `+state`

Type: `string`

Override the name of the folder used to contain/group the NgRx files: contains actions, effects, reducers. selectors. (e.g., +state)

### facade

Default: `false`

Type: `boolean`

Create a Facade class for the the Feature (e.g., --facade).

### module

Type: `string`

Path to ngModule; host directory will contain the new '+state' directory (e.g., libs/comments/src/lib/comments-state.module.ts).

### name

Type: `string`

Name of the NgRx feature (e.g., Products, Users, etc.). Recommended to use plural form for name.

### onlyAddFiles

Default: `false`

Type: `boolean`

Only add new NgRx files, without changing the module file (e.g., --onlyAddFiles).

### onlyEmptyRoot

Default: `false`

Type: `boolean`

Do not generate any files. Only generate StoreModule.forRoot and EffectsModule.forRoot (e.g., --onlyEmptyRoot).

### root

Default: `false`

Type: `boolean`

Add StoreModule.forRoot and EffectsModule.forRoot() instead of forFeature (e.g., --root).

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipPackageJson

Default: `false`

Type: `boolean`

Do not add NgRx dependencies to package.json (e.g., --skipPackageJson)
