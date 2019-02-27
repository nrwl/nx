# application

Create an application

## Usage

```bash
ng generate application ...

```

## Options

### prefix

Alias(es): p

Type: `string`

The prefix to apply to generated selectors.

### framework

Default: `angular`

Type: `string`

The Framework for the application.

### directory

Type: `string`

The directory of the new application.

### inlineStyle

Alias(es): s

Default: `false`

Type: `boolean`

Specifies if the style will be in the ts file.

### inlineTemplate

Alias(es): t

Default: `false`

Type: `boolean`

Specifies if the template will be in the ts file.

### viewEncapsulation

Type: `string`

Specifies the view encapsulation strategy.

### routing

Default: `false`

Type: `boolean`

Generates a routing module.

### name

Type: `string`

The name of the application.

### style

Default: `css`

Type: `string`

The file extension to be used for style files.

### skipTests

Alias(es): S

Default: `false`

Type: `boolean`

Skip creating spec files.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipPackageJson

Default: `false`

Type: `boolean`

Do not add dependencies to package.json.

### unitTestRunner

Default: `jest`

Type: `string`

Test runner to use for unit tests

### e2eTestRunner

Default: `cypress`

Type: `string`

Test runner to use for end to end (e2e) tests

### tags

Type: `string`

Add tags to the application (used for linting)
