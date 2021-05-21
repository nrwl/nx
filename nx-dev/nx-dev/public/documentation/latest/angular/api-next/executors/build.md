# build

Build a Next.js app

Properties can be configured in angular.json when defining the executor, or when invoking it.

## Properties

### fileReplacements

Type: `object[]`

Replace files with other files in the build.

#### replace

Type: `string`

undefined

#### with

Type: `string`

undefined

### nextConfig

Type: `string`

Path to a function which takes phase, config, and builder options, and returns the resulting config.

### outputPath

Type: `string`

The output path of the generated files.

### root

Type: `string`

The source root
