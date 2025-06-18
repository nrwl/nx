---
title: Polygraph Workspace Graph
description: 'Visualize dependencies between all workspaces and repositories in your organization with cross-repository impact analysis and architectural insights.'
---

# Polygraph Workspace Graph

The Polygraph workspace graph visualizes dependencies between all workspaces and repositories in your organization, providing unprecedented visibility into your entire codebase ecosystem.

Unlike traditional project graphs that show only a single workspace, the Polygraph workspace graph extends visibility across your entire organization, enabling you to see the big picture and understand how all your repositories interconnect.

![Polygraph Workspace Graph Overview](/docs/nx-cloud/enterprise/polygraph/screenshots/workspace-graph-overview.png)

## Key Benefits

### 🎯 Identify Consumers of Shared Libraries
Enable confident API changes and deprecations by knowing exactly who will be affected. Before making breaking changes to a shared library, see all the applications and services that depend on it across your entire organization.

![Library Consumers View](/docs/nx-cloud/enterprise/polygraph/screenshots/library-consumers-view.png)

### 🏗️ Understand Organizational Code Structure
Help leadership make informed decisions about architecture and team boundaries. Get a bird's-eye view of how your codebase is structured and identify opportunities for consolidation or separation.

![Organizational Architecture View](/docs/nx-cloud/enterprise/polygraph/screenshots/organizational-architecture.png)

### 💥 Impact Analysis Before Breaking Changes
See the blast radius of changes across your entire tech stack. Understand which teams and projects will be affected by your changes before you make them.

![Impact Analysis View](/docs/nx-cloud/enterprise/polygraph/screenshots/impact-analysis.png)

## Interactive Features

The workspace graph provides powerful interactive capabilities:

### Filtering and Navigation
- **Filter by teams**: Focus on repositories owned by specific teams
- **Filter by technologies**: See only repositories using particular frameworks or languages
- **Filter by repositories**: Zoom in on specific repos and their dependencies
- **Dependency depth control**: Adjust how many levels of dependencies to display

![Workspace Graph Filters](/docs/nx-cloud/enterprise/polygraph/screenshots/workspace-graph-filters.png)

### Visualization Options
- **Hierarchical layout**: Organize repositories by team or organizational structure
- **Dependency layout**: Arrange repositories based on their dependency relationships
- **Custom grouping**: Group repositories by custom criteria relevant to your organization

## Use Cases

### Breaking Change Planning
Before making breaking changes to a shared library or API:

1. **Identify all consumers** using the workspace graph
2. **Assess impact scope** across teams and repositories
3. **Plan migration strategy** with full visibility of affected projects
4. **Coordinate with teams** who will be impacted

### Architectural Decision Making
When planning architectural changes:

1. **Visualize current state** of dependencies and relationships
2. **Identify bottlenecks** and heavily-coupled components
3. **Plan refactoring** with understanding of organizational impact
4. **Validate architectural principles** across the entire codebase

### Code Reuse and Duplication Analysis
Discover opportunities for code sharing:

1. **Identify similar functionality** across repositories
2. **Find candidates for shared libraries** based on usage patterns
3. **Eliminate duplication** by promoting common code to shared packages
4. **Track adoption** of shared libraries across teams

### Team Coordination
Improve cross-team collaboration:

1. **Understand team boundaries** based on code ownership
2. **Identify collaboration opportunities** between teams working on related code
3. **Plan team restructuring** with data-driven insights
4. **Optimize team responsibilities** based on actual code relationships

## Getting Started

### Prerequisites
- Nx Cloud Enterprise subscription
- Connected repositories (can include metadata-only workspaces)
- Appropriate permissions to view organizational data

### Accessing the Workspace Graph
1. Navigate to your Nx Cloud dashboard
2. Select "Polygraph" from the main navigation
3. Click on "Workspace Graph" to open the interactive view
4. Use filters and controls to explore your organization's codebase

### Best Practices

#### Start with High-Level View
Begin by viewing the entire organization's graph to understand the overall structure before drilling down into specific areas.

#### Use Filters Strategically
Apply filters to focus on specific aspects:
- Team ownership when planning organizational changes
- Technology stacks when planning migrations
- Specific repositories when planning feature changes

#### Regular Review Sessions
Schedule regular architectural review sessions using the workspace graph to:
- Identify emerging patterns
- Spot potential issues early
- Make data-driven architectural decisions
- Track progress on organizational initiatives

#### Combine with Conformance Data
Use the workspace graph alongside conformance data to:
- Understand compliance patterns across teams
- Plan rollout strategies for new standards
- Identify repositories that need attention

## Advanced Features

### Custom Metadata Integration
Enhance the graph with custom organizational metadata:
- Team ownership information
- Technology classification
- Business criticality levels
- Compliance status indicators

### Integration with Development Workflows
Connect the workspace graph to your development processes:
- Pre-commit hooks for impact analysis
- Pull request comments with dependency information
- Automated notifications for breaking changes
- Integration with planning and project management tools

## Support and Resources

For questions about the workspace graph:
- Contact your Nx representative
- Visit the [Nx Cloud Enterprise documentation](/enterprise)
- Join the [Nx Community Discord](https://discord.gg/nx) for peer support

The workspace graph is continuously evolving with new features and capabilities. Stay tuned for updates on enhanced visualization options, AI-powered insights, and deeper integration with development workflows.