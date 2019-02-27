# jest-project [hidden]

Add Jest configuration to a project

## Usage

```bash
ng generate jest-project ...

```

## Options

### project

Type: `string`

The name of the project.

### skipSetupFile

Default: `false`

Type: `boolean`

[Deprecated]: Skips the setup file required for angular. (Use --setup-file)

### setupFile

Default: `angular`

Type: `string`

The setup file to be generated

### skipSerializers

Default: `false`

Type: `boolean`

Skips the serializers required to snapshot angular templates

### supportTsx

Default: `false`

Type: `boolean`

Setup tsx support
