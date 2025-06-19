---
title: Metadata-Only Workspaces
description: 'Include non-Nx repositories in Polygraph features without requiring full Nx adoption. Enable zero-friction onboarding for legacy and existing repositories.'
---

# Metadata-Only Workspaces

Metadata-only workspaces enable you to include non-Nx repositories in Polygraph features without requiring full Nx adoption across teams. This powerful capability removes adoption barriers and provides immediate organizational visibility into previously isolated codebases.

With metadata-only workspaces, you can achieve zero-friction adoption that allows immediate value without requiring team buy-in or workflow changes.

![Metadata-Only Workspaces Overview](/docs/nx-cloud/enterprise/polygraph/screenshots/metadata-only-overview.png)

## What are Metadata-Only Workspaces?

A metadata-only workspace in Nx Cloud is a way to include repositories that aren't Nx-based into Nx Cloud's features (like Polygraph) without requiring those teams to fully adopt Nx. This lets organizations gain insights and apply standards across all their code, including legacy or non-Nx repositories, with zero changes needed to existing repos.

Unlike full Nx workspaces that run complete build and test pipelines, metadata-only workspaces focus on organizational structure and metadata collection with minimal compute usage.

## Key Benefits

### ⚡ Zero Changes Required to Existing Repos
Remove adoption barriers and political friction by allowing immediate value without requiring team buy-in. Teams can continue using their existing tools, workflows, and build processes while still participating in organizational standards and visibility.

### 👀 Immediate Visibility and Compliance Checking
Provide instant insights into previously dark areas of your codebase. Enable instant visibility and compliance checking for codebases that previously were outside of Nx's ecosystem.

### 🔗 Cross-Repository Integration
Include legacy repositories in organizational standards enforcement and impact analysis. Understand dependencies and relationships even when repositories use different technologies or build systems.

### 💰 Minimal Resource Usage
Metadata-only workspaces don't use full workflow compute—usage is minimal. They allow organizational metadata and structure to be brought into the Nx Cloud UI without the overhead of running Nx tasks.

![Metadata Collection Process](/docs/nx-cloud/enterprise/polygraph/screenshots/metadata-collection-process.png)

## Use Cases

### Legacy Repository Integration
Include legacy repositories in organizational governance without requiring modernization:

**Scenario**: Large organization with 50+ repositories built with various technologies
- **Challenge**: No visibility into dependencies between legacy and modern repositories
- **Solution**: Add legacy repos as metadata-only workspaces
- **Result**: Complete organizational visibility and standards enforcement

### Gradual Nx Adoption Strategy
Use metadata-only workspaces as a stepping stone to full Nx adoption:

**Adoption Path**:
1. **Start**: Add existing repositories as metadata-only workspaces
2. **Gain Value**: Immediate compliance checking and dependency visibility
3. **Build Confidence**: Teams see value without disruption
4. **Migrate Gradually**: Convert to full Nx workspaces when ready

![Gradual Adoption Strategy](/docs/nx-cloud/enterprise/polygraph/screenshots/gradual-adoption-strategy.png)

### Mixed Technology Stack Organizations
Handle organizations with diverse technology stacks:

**Example Organization**:
- Java Spring Boot microservices
- Python data processing scripts
- React frontend applications
- Go backend services
- Legacy PHP applications

All can be included in Polygraph features through metadata-only workspaces.

## Setting Up Metadata-Only Workspaces

### Prerequisites
- Nx Cloud Enterprise subscription
- Repository access permissions
- GitHub integration (recommended for bulk onboarding)

### Quick Setup Process

#### 1. Repository Detection
Nx Cloud can automatically detect repositories in your organization:

![Repository Detection](/docs/nx-cloud/enterprise/polygraph/screenshots/repository-detection.png)

```bash
# Connect your GitHub organization
nx-cloud connect github-org your-org-name

# Scan for repositories
nx-cloud scan repositories --include-non-nx
```

#### 2. Workspace Creation
Create metadata-only workspaces for selected repositories:

```bash
# Create metadata-only workspace
nx-cloud create-workspace \
  --type metadata-only \
  --repository your-repo-name \
  --name "Legacy API Service"
```

## Integration with Polygraph Features

### Workspace Graph Integration
Metadata-only workspaces appear in the workspace graph alongside full Nx workspaces:

- **Dependency Visualization**: See how legacy repos connect to modern applications
- **Impact Analysis**: Understand changes that affect both Nx and non-Nx repositories
- **Architectural Insights**: Get complete organizational code structure view

### Conformance Rules
Apply conformance rules to metadata-only workspaces:

- **Security Standards**: Enforce security scanning across all repositories
- **Dependency Management**: Monitor library versions organization-wide
- **Documentation Requirements**: Ensure all repositories have proper documentation

![Conformance with Metadata-Only](/docs/nx-cloud/enterprise/polygraph/screenshots/conformance-metadata-only.png)

### Custom Workflows
Include metadata-only workspaces in custom workflows:

- **Regular Security Scans**: Monitor vulnerabilities across all code
- **Compliance Checking**: Ensure organizational standards
- **Dependency Updates**: Track library versions across technology stacks

## Pricing and Resource Usage

### Cost Structure
- **Included**: Some number of metadata-only workspaces included per Enterprise contract
- **Additional**: Additional metadata-only workspaces available per workspace pricing
- **Minimal Compute**: Very low compute credit usage for metadata collection

## Support and Resources

For questions about metadata-only workspaces:
- Contact your Nx representative
- Visit the [Nx Cloud Enterprise documentation](/enterprise)
- Review the [Polygraph overview](/ci/recipes/enterprise/polygraph/polygraph-overview) for context

Metadata-only workspaces are a powerful tool for achieving organizational visibility and standards enforcement across your entire codebase, regardless of technology choices or current development practices.
