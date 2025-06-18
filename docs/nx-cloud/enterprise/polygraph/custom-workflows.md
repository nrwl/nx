---
title: Custom Workflows
description: 'Run scheduled tasks to gather data and run checks automatically across your organization with automated data collection and proactive monitoring.'
---

# Custom Workflows

Custom workflows enable you to run scheduled tasks that gather data and run checks automatically across your organization. This ensures your dashboards and reports always reflect the current state without manual intervention, while keeping responsible parties informed through automated notifications.

Custom workflows are particularly valuable for organizations with repositories that don't have regular CI pipeline activity or where you want to maintain consistent monitoring regardless of development frequency.

![Custom Workflows Dashboard](/docs/nx-cloud/enterprise/polygraph/screenshots/custom-workflows-dashboard.png)

## Key Benefits

### 🔄 Automated Data Collection
Ensures your dashboards and reports always reflect current state without manual intervention. No more stale data or outdated compliance reports.

### 📧 Email Notifications for Failures
Keeps responsible parties informed without requiring them to constantly check dashboards. Get notified immediately when issues are detected.

### 🛡️ Regular Compliance Monitoring
Keep security audits current even for repositories with infrequent changes. Just because you didn't make a code change doesn't mean your repository isn't vulnerable.

### ⏰ Scheduled Execution
Run checks on your schedule, not just when code changes. This is especially valuable for repositories that are rarely updated but still need monitoring.

## Use Cases

### Daily Conformance Checks
Set up daily conformance checks to identify problem areas before they become critical issues.

**Example workflow:**
- **Schedule**: Daily at 2 AM
- **Scope**: All repositories in organization
- **Checks**: Linting standards, dependency versions, security vulnerabilities
- **Notifications**: Send summary report to platform team

![Daily Conformance Workflow](/docs/nx-cloud/enterprise/polygraph/screenshots/daily-conformance-workflow.png)

### Library Update Tracking
Reduce time and hassle of following up manually with teams to update a new library version.

**Example workflow:**
- **Schedule**: Weekly on Mondays
- **Scope**: Repositories using specific libraries
- **Checks**: Library version compliance
- **Notifications**: Alert team leads about outdated dependencies

### Security Audit Monitoring
Running security audits daily gives you peace of mind in repositories you haven't touched in months.

**Example workflow:**
- **Schedule**: Daily security scans
- **Scope**: All production repositories
- **Checks**: npm audit, dependency vulnerabilities, license compliance
- **Notifications**: Immediate alerts for critical vulnerabilities

![Security Audit Workflow](/docs/nx-cloud/enterprise/polygraph/screenshots/security-audit-workflow.png)

### Migration Progress Tracking
Monitor organization-wide migration progress without manual status requests.

**Example workflow:**
- **Schedule**: Bi-weekly progress checks
- **Scope**: Repositories in migration scope
- **Checks**: Framework version, configuration compliance, migration markers
- **Notifications**: Progress reports to leadership team

## Setting Up Custom Workflows

### Prerequisites
- Nx Cloud Enterprise subscription
- Appropriate permissions to create and manage workflows
- Connected repositories (including metadata-only workspaces)

### Creating a Workflow

1. **Navigate to Custom Workflows**
   - Go to your Nx Cloud dashboard
   - Select "Polygraph" from the main navigation
   - Click on "Custom Workflows"

![Custom Workflows Navigation](/docs/nx-cloud/enterprise/polygraph/screenshots/custom-workflows-navigation.png)

2. **Configure Workflow Settings**
   - **Name**: Descriptive name for your workflow
   - **Schedule**: Define when the workflow should run
   - **Scope**: Select which repositories to include
   - **Tasks**: Define what checks or tasks to execute

3. **Set Up Notifications**
   - **Recipients**: Who should receive notifications
   - **Conditions**: When to send notifications (failures, summaries, all results)
   - **Format**: Email templates and formatting options

![Workflow Configuration](/docs/nx-cloud/enterprise/polygraph/screenshots/workflow-configuration.png)

### Workflow Types

#### Conformance Workflows
Run conformance rules on a schedule to monitor compliance:

```yaml
name: "Daily Conformance Check"
schedule: "0 2 * * *"  # Daily at 2 AM
scope:
  - all-repositories
tasks:
  - type: conformance
    rules:
      - linting-standards
      - dependency-security
      - code-quality
notifications:
  email:
    recipients: ["platform-team@company.com"]
    on: ["failures", "summary"]
```

#### Security Audit Workflows
Regular security scanning across repositories:

```yaml
name: "Security Audit"
schedule: "0 1 * * *"  # Daily at 1 AM
scope:
  - production-repositories
tasks:
  - type: security-audit
    checks:
      - npm-audit
      - license-compliance
      - dependency-vulnerabilities
notifications:
  email:
    recipients: ["security-team@company.com"]
    on: ["critical-failures"]
```

#### Data Collection Workflows
Gather organizational metrics and insights:

```yaml
name: "Weekly Metrics Collection"
schedule: "0 0 * * 1"  # Weekly on Monday
scope:
  - all-repositories
tasks:
  - type: metrics-collection
    metrics:
      - dependency-usage
      - code-coverage
      - repository-health
notifications:
  email:
    recipients: ["leadership@company.com"]
    on: ["summary"]
```

## Workflow Management

### Monitoring Workflow Execution
Track the status and results of your custom workflows:

- **Execution History**: View past runs and their results
- **Success/Failure Rates**: Monitor workflow reliability
- **Execution Time**: Track performance and optimization opportunities
- **Resource Usage**: Monitor compute credit consumption

![Workflow Monitoring](/docs/nx-cloud/enterprise/polygraph/screenshots/workflow-monitoring.png)

### Workflow Templates
Use pre-built templates for common scenarios:

- **Security Compliance**: Daily security audits and vulnerability scans
- **Migration Tracking**: Monitor progress of framework or library migrations
- **Code Quality**: Regular code quality and standards compliance checks
- **Dependency Management**: Track and notify about dependency updates

### Troubleshooting Workflows

#### Common Issues and Solutions

**Workflow Not Executing**
- Check schedule configuration syntax
- Verify repository permissions
- Ensure workflow is enabled

**High Resource Usage**
- Optimize scope to reduce repository count
- Adjust frequency to balance thoroughness with cost
- Use filters to target specific repository types

**Missing Notifications**
- Verify email addresses and permissions
- Check notification conditions and triggers
- Review spam filters and email delivery

## Advanced Configuration

### Conditional Execution
Run workflows based on specific conditions:

```yaml
conditions:
  - repository_type: "production"
  - last_commit_age: "> 7 days"
  - compliance_status: "failing"
```

### Custom Scripts
Execute custom scripts and tools:

```yaml
tasks:
  - type: custom-script
    script: |
      npm audit --audit-level=moderate
      echo "Custom security check completed"
    timeout: 300
```

### Integration with External Tools
Connect workflows with external monitoring and alerting systems:

- Slack notifications
- Jira ticket creation
- PagerDuty alerts
- Custom webhook integrations

## Pricing and Resource Usage

### Compute Credits
Custom workflows consume minimal compute credits:
- **Data collection**: Very low resource usage
- **Conformance checks**: Low resource usage
- **Security audits**: Moderate resource usage based on scope

### Cost Optimization
- Use targeted scopes to reduce unnecessary checks
- Optimize frequency based on repository activity
- Leverage caching for repeated operations

## Coming Soon

### AI-Powered Workflows
- **Self-healing CI**: Automatically fix common CI issues
- **Intelligent Scheduling**: AI-optimized scheduling based on repository activity
- **Predictive Alerts**: Early warning system for potential issues

### Enhanced Integrations
- **IDE Integration**: Workflow results in development environments
- **Pull Request Integration**: Automatic workflow execution on pull requests
- **Advanced Analytics**: Deeper insights into workflow effectiveness

## Support and Resources

For help with custom workflows:
- Contact your Nx representative
- Visit the [Nx Cloud Enterprise documentation](/enterprise)
- Join the [Nx Community Discord](https://discord.gg/nx) for peer support

Custom workflows are a powerful tool for maintaining organizational standards and ensuring continuous monitoring across your entire codebase ecosystem.