# library

Create a library

## Usage

```bash
ng generate library ...

```

## Options

### directory

Type: `string`

A directory where the app is placed

### framework

Default: `none`

Type: `string`

The framework this library uses

### lazy

Default: `false`

Type: `boolean`

Add RouterModule.forChild when set to true, and a simple array of routes when set to false.

### module

Default: `true`

Type: `boolean`

[Deprecated]: Include an NgModule in the library.

### name

Type: `string`

Library name

### parentModule

Type: `string`

Update the router configuration of the parent module using loadChildren or children, depending on what `lazy` is set to.

### prefix

Alias(es): p

Type: `string`

The prefix to apply to generated selectors.

### publishable

Default: `false`

Type: `boolean`

Generate a simple TS library when set to true.

### routing

Default: `false`

Type: `boolean`

Add router configuration. See lazy for more information.

### simpleModuleName

Default: `false`

Type: `boolean`

Keep the module name simple (when using --directory)

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipPackageJson

Default: `false`

Type: `boolean`

Do not add dependencies to package.json.

### skipTsConfig

Default: `false`

Type: `boolean`

Do not update tsconfig.json for development experience.

### style

Default: `css`

Type: `string`

The file extension to be used for style files.

### tags

Type: `string`

Add tags to the library (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Test runner to use for unit tests
