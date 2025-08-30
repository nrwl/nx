# Enumeration: DependencyType

Type of dependency between projects

## Table of contents

### Enumeration Members

- [dynamic](/reference/core-api/devkit/documents/DependencyType#dynamic)
- [implicit](/reference/core-api/devkit/documents/DependencyType#implicit)
- [static](/reference/core-api/devkit/documents/DependencyType#static)
- [type](/reference/core-api/devkit/documents/DependencyType#type)

## Enumeration Members

### dynamic

• **dynamic** = `"dynamic"`

Dynamic dependencies are brought in by the module at run time

---

### implicit

• **implicit** = `"implicit"`

Implicit dependencies are inferred

---

### static

• **static** = `"static"`

Static dependencies are tied to the loading of the module

---

### type

• **type** = `"type"`

Type-only dependencies are used for TypeScript type information and do not exist at runtime
