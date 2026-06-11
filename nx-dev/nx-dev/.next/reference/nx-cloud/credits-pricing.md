---
title: Nx Cloud Credit Pricing Reference
description: Pricing information for Nx Cloud credits and agent resource classes
filter: 'type:References'
---

Credits are the Nx Cloud currency that enables usage-based pricing. This system allows for transparent cost tracking and flexible billing based on actual consumption of resources.

## What are credits?

Credits represent the computational resources consumed during CI/CD operations. They account for:

- CPU usage
- Memory consumption
- Setup and provisioning costs
- Storage operations
- Task execution time
- AI computation

## Credit pricing

### Non-compute pricing

- **CI Pipeline Execution: 500 credits per execution**. A CI Pipeline Execution is a CI run or a Workflow run (depending on your CI provider). For instance, running a PR or running CI on the main branch are CI Pipeline Executions.
- **AI-Powered Self-Healing CI: 6555 credits per 1M input tokens, 32700 credits per 1M output tokens**. Credits are consumed by the fix-ci command.

### Agents resource classes

#### Docker / Linux AMD64

| Resource Class | Specifications | Credits/min |
| -------------- | -------------- | ----------- |
| Small          | 1 vCPU         | 5           |
| Medium         | 2 vCPU         | 10          |
| Large          | 4 vCPU         | 20          |
| Extra large    | 8 vCPU         | 40          |

#### Docker / Linux ARM64

| Resource Class | Specifications | Credits/min |
| -------------- | -------------- | ----------- |
| Medium         | 2 vCPU         | 13          |
| Large          | 4 vCPU         | 26          |
| Extra large    | 8 vCPU         | 52          |

_Note: Linux resource classes have memory available in an approximate 1:4 ratio per vCPU core._

#### Docker / Windows

| Resource Class | Specifications  | Credits/min |
| -------------- | --------------- | ----------- |
| Medium         | 3 vCPU, 6GB RAM | 40          |

---

_Note: Prices do not include applicable taxes. Credit pricing and allocations subject to change._
