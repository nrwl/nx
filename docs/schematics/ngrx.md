# ngrx

Add NgRx support to a module

## Usage

```bash
ng generate ngrx ...

```

### Options

| Name              | Alias | Description                                                                                                                          | Type    | Default value |
| ----------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------------- |
| `name`            |       | Name of the NgRx feature (e.g., Products, Users, etc.). Recommended to use plural form for name.                                     | string  | `undefined`   |
| `module`          |       | Path to ngModule; host directory will contain the new '+state' directory (e.g., libs/comments/src/lib/comments-state.module.ts).     | string  | `undefined`   |
| `directory`       |       | Override the name of the folder used to contain/group the NgRx files: contains actions, effects, reducers. selectors. (e.g., +state) | string  | `+state`      |
| `root`            |       | Add StoreModule.forRoot and EffectsModule.forRoot() instead of forFeature (e.g., --root).                                            | boolean | `false`       |
| `facade`          |       | Create a Facade class for the the Feature (e.g., --facade).                                                                          | boolean | `false`       |
| `onlyAddFiles`    |       | Only add new NgRx files, without changing the module file (e.g., --onlyAddFiles).                                                    | boolean | `false`       |
| `onlyEmptyRoot`   |       | Do not generate any files. Only generate StoreModule.forRoot and EffectsModule.forRoot (e.g., --onlyEmptyRoot).                      | boolean | `false`       |
| `skipFormat`      |       | Skip formatting files                                                                                                                | boolean | `false`       |
| `skipPackageJson` |       | Do not add NgRx dependencies to package.json (e.g., --skipPackageJson)                                                               | boolean | `false`       |
