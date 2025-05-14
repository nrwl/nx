---
title: Nx Console & Nx Cloud Integration
description: Learn how Nx Console integrates with Nx Cloud to provide CI pipeline visibility, notifications, and quick access to build results directly from your editor.
---

# Nx Console & Nx Cloud Integration

Nx Console for VSCode is integrated with Nx Cloud to help you stay on top of your CI Pipelines without leaving the editor.

If your workspace is connected to Nx Cloud, you will have access to a new view in the Nx Console sidebar that provides at-a-glance information about your running and recent CI pipeline executions.

![Nx Console Nx Cloud View](/shared/images/nx-console/cloud-view.png)

{% callout type="note" %}
Nx Console will only show information about CI Pipelines from the last hour and triggered from branches that you have modified locally. If you want to see information about other pipelines, use the Nx Cloud application at [cloud.nx.app](https://cloud.nx.app).
{% /callout %}

## Notifications

In addition to the view, you will receive notifications when a pipeline completes or a task in it fails.

![Nx Console Nx Cloud Notifications](/shared/images/nx-console/cloud-notification.png)

You can click on the buttons to view the results directly in Nx Cloud or open the Pull Request in the browser.

To only be notified on failure or turn off notifications altogether, you can change the `nxConsole.nxCloudNotifications` setting.

## JetBrains

This feature is only available in VSCode but coming soon to JetBrains. For now, you can see whether you're connected to Nx Cloud and navigate directly to the Nx Cloud application from the Nx Console Toolwindow.
