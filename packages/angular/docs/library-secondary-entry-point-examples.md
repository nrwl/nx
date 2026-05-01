## Examples

##### Basic Usage

Create a secondary entrypoint named `button` in the `ui` library.

```bash
nx g @nx/angular:library-secondary-entry-point --library=ui --name=button
```

##### Skip generating module

Create a secondary entrypoint named `button` in the `ui` library but skip creating an NgModule.

```bash
nx g @nx/angular:library-secondary-entry-point --library=ui --name=button --skipModule
```
