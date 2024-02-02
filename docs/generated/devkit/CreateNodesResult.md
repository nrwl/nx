# Interface: CreateNodesResult

## Table of contents

### Properties

- [externalNodes](../../devkit/documents/CreateNodesResult#externalnodes): Record<string, ProjectGraphExternalNode>
- [projects](../../devkit/documents/CreateNodesResult#projects): Record<string, Optional<ProjectConfiguration, "root">>

## Properties

### externalNodes

• `Optional` **externalNodes**: `Record`\<`string`, [`ProjectGraphExternalNode`](../../devkit/documents/ProjectGraphExternalNode)\>

A map of external node name -> external node. External nodes do not have a root, so the key is their name.

---

### projects

• `Optional` **projects**: `Record`\<`string`, `Optional`\<[`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration), `"root"`\>\>

A map of project root -> project configuration
