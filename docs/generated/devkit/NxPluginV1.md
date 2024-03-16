# Type alias: NxPluginV1

Ƭ **NxPluginV1**: `Object`

**`Deprecated`**

Use [NxPluginV2](../../devkit/documents/NxPluginV2) instead. This will be removed in Nx 19

#### Type declaration

| Name                      | Type                                                                            | Description                                                                                                                                                                                              |
| :------------------------ | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                    | `string`                                                                        | -                                                                                                                                                                                                        |
| `processProjectGraph?`    | `ProjectGraphProcessor`                                                         | **`Deprecated`** Use [CreateNodes](../../devkit/documents/CreateNodes) and [CreateDependencies](../../devkit/documents/CreateDependencies) instead. This will be removed in Nx 19                        |
| `projectFilePatterns?`    | `string`[]                                                                      | A glob pattern to search for non-standard project files. @example: ["*.csproj", "pom.xml"] **`Deprecated`** Use [CreateNodes](../../devkit/documents/CreateNodes) instead. This will be removed in Nx 19 |
| `registerProjectTargets?` | [`ProjectTargetConfigurator`](../../devkit/documents/ProjectTargetConfigurator) | **`Deprecated`** Add targets to the projects inside of [CreateNodes](../../devkit/documents/CreateNodes) instead. This will be removed in Nx 19                                                          |
