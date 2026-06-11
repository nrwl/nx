▸ **parseTargetString**(`targetString`, `projectGraph`): [`Target`](/docs/reference/devkit/Target)

Parses a target string into {project, target, configuration}

Examples:
```typescript
parseTargetString("proj:test", graph) // returns { project: "proj", target: "test" }
parseTargetString("proj:test:production", graph) // returns { project: "proj", target: "test", configuration: "production" }
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `targetString` | `string` | target reference |
| `projectGraph` | [`ProjectGraph`](/docs/reference/devkit/ProjectGraph) | - |

#### Returns

[`Target`](/docs/reference/devkit/Target)

▸ **parseTargetString**(`targetString`, `ctx`): [`Target`](/docs/reference/devkit/Target)

Parses a target string into {project, target, configuration}. Passing a full
[ExecutorContext](/docs/reference/devkit/ExecutorContext) enables the targetString to reference the current project.

Examples:
```typescript
parseTargetString("test", executorContext) // returns { project: "proj", target: "test" }
parseTargetString("proj:test", executorContext) // returns { project: "proj", target: "test" }
parseTargetString("proj:test:production", executorContext) // returns { project: "proj", target: "test", configuration: "production" }
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `targetString` | `string` |
| `ctx` | [`ExecutorContext`](/docs/reference/devkit/ExecutorContext) |

#### Returns

[`Target`](/docs/reference/devkit/Target)
