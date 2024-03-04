# Interface: PluginObjectConfiguration

Used to configure a plugin with options and installation version

## Table of contents

### Properties

- [options](../../devkit/documents/PluginObjectConfiguration#options): unknown
- [plugin](../../devkit/documents/PluginObjectConfiguration#plugin): string
- [version](../../devkit/documents/PluginObjectConfiguration#version): string

## Properties

### options

• `Optional` **options**: `unknown`

Options passed into the plugin's CreateNodes and CreateDependencies functions

---

### plugin

• **plugin**: `string`

Plugin name (e.g. '@nx/react')

---

### version

• `Optional` **version**: `string`

Version used to install the plugin when running via the nx wrapper. See https://nx.dev/recipes/installation/install-non-javascript
