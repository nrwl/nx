# move

Move an Angular application or library to another folder

## Usage

```bash
ng generate move ...
```

```bash
ng g mv ... # same
```

By default, Nx will search for `move` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
ng g @nrwl/angular:move ...
```

Show what will be generated without writing to disk:

```bash
ng g move ... --dry-run
```

## Options

### destination

Type: `string`

The folder to move the Angular project into

### projectName

Type: `string`

The name of the Angular project to move
