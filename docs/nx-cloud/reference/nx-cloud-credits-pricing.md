# Nx Cloud Credit Pricing Reference

## Overview

Credits are the Nx Cloud currency that enables usage-based pricing. This system allows for transparent cost tracking and flexible billing based on actual consumption of resources.

## What Are Credits?

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

| Resource Class | Specifications    | Credits/min |
| -------------- | ----------------- | ----------- |
| Small          | 1 vCPU, 2GB RAM   | 5           |
| Medium         | 2 vCPU, 4GB RAM   | 10          |
| Medium +       | 3 vCPU, 6GB RAM   | 15          |
| Large          | 4 vCPU, 8GB RAM   | 20          |
| Large +        | 4 vCPU, 10GB RAM  | 30          |
| Extra large    | 8 vCPU, 16GB RAM  | 40          |
| Extra large +  | 10 vCPU, 20GB RAM | 60          |

#### Docker / Linux ARM64

| Resource Class | Specifications   | Credits/min |
| -------------- | ---------------- | ----------- |
| Medium         | 2 vCPU, 8GB RAM  | 13          |
| Large          | 4 vCPU, 16GB RAM | 26          |
| Extra large    | 8 vCPU, 32GB RAM | 52          |

#### Docker / Windows

| Resource Class | Specifications  | Credits/min |
| -------------- | --------------- | ----------- |
| Medium         | 3 vCPU, 6GB RAM | 40          |

---

_Note: Prices do not include applicable taxes. Credit pricing and allocations subject to change._
