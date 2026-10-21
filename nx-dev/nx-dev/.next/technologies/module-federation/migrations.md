For an overview of the plugin and setup instructions, see the [@nx/module-federation introduction](/docs/technologies/module-federation/introduction).

The @nx/module-federation plugin provides various migrations to help you migrate to newer versions of module-federation projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.0.x

### `rewrite-module-federation-internal-subpath-imports`
**Version**: 23.0.0-beta.25

Rewrites `@nx/module-federation/src/*` subpath imports now that the `./src/*` subpath is no longer exposed by `@nx/module-federation`'s exports map. Named imports/exports of public symbols are routed to `@nx/module-federation` and the rest to the new `@nx/module-federation/internal` entry; `require`, dynamic `import` and `jest.mock` calls reference the whole module and are routed to `@nx/module-federation/internal`.



## 22.6.x

### 22.6.0-package-updates
**Version**: 22.6.0-beta.10


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `^2.1.0` | Updated only
| `@module-federation/runtime` | `^2.1.0` | Updated only
| `@module-federation/sdk` | `^2.1.0` | Updated only
| `@module-federation/node` | `^2.7.21` | Updated only



## 22.2.x

### 22.2.0-package-updates
**Version**: 22.2.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `^0.21.2` | Updated only
| `@module-federation/runtime` | `^0.21.2` | Updated only
| `@module-federation/sdk` | `^0.21.2` | Updated only
| `@module-federation/node` | `^2.7.21` | Updated only



## 21.4.x

### 21.4.0-package-updates
**Version**: 21.4.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/sdk` | `^0.18.0` | Updated only
| `@module-federation/enhanced` | `^0.18.0` | Updated only
| `@module-federation/runtime` | `^0.18.0` | Updated only
| `@module-federation/node` | `^2.7.11` | Updated only


### 21.4.0-http-proxy-middleware-package-updates
**Version**: 21.4.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `http-proxy-middleware` | `^3.0.5` | Updated only



## 21.3.x

### 21.3.0-package-updates
**Version**: 21.3.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `^0.17.0` | Updated only
| `@module-federation/node` | `^2.7.9` | Updated only
| `@module-federation/sdk` | `^0.17.0` | Updated only



## 21.2.x

### 21.2.0-package-updates
**Version**: 21.2.0-beta.6


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `^0.15.0` | Updated only
| `@module-federation/runtime` | `^0.15.0` | Updated only
| `@module-federation/sdk` | `^0.15.0` | Updated only


