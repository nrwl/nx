---
title: Nx Cloud Pipelines Come To Nx Console
slug: nx-cloud-pipelines-come-to-nx-console
authors: [Zack DeRose]
tags: [nx, nx-cloud, nx-console, enterprise]
cover_image: /blog/images/2024-11-25/thumbnail.png
---

## Your CI Pipelines, Now At-A-Glance In Your IDE

We're in the process of adding a new integration between [Nx Cloud](/nx-cloud), our CI product, and [Nx Console](/getting-started/editor-setup) our official plugin for the VSCode and JetBrains IDEs!

Now, once you've [connected your Nx Console to Nx Cloud](https://blog.nrwl.io/nx-console-meets-nx-cloud-d45dc099dc5d), you will have access to a new panel in the console that shows all of your recent CI Pipelines, including those in progress now.

{% video-player src="/documentation/blog/media/nx-console-pipeline-running.mp4" alt="Nx Console CI Pipeline Execution" /%}

This way, you can keep an eye on the status of the pipeline of your latest PR, and always just 1 click away from seeing detailed your results on Nx Cloud.

## Notifications On What You Care About Most

In addition to a panel where you can see all of your recent pipelines, you can also receive pop-up notifications when a pipeline completes

{% video-player src="/documentation/blog/media/nxconsole-ci-completion.mp4" alt="Nx Console CI Completion" /%}

Head to the Nx Console settings to adjust controls on these notifications. This will allow you to adjust notifications to only show for failed runs if you prefer, or to turn off the notifications altogether.

![Notification Settings](/blog/images/2024-11-25/notification-settings.png)

## Coming Soon!

We're in the process of landing this on Nx Console for VSCode now - and we're already dog-fooding it on the `nx` and `nx-console` repos. It will be landing in the next few week for all Nx Cloud projects, with the feature landing on Nx Console for JetBrains IDEs to follow soon!

For more on Nx Cloud go to [nx.dev/nx-cloud](/nx-cloud)! Nx Cloud is free to get started, so you can [create your free account today](https://nx.app)!

And if you're not using Nx Console yet, you can get started now with Nx Console available for VSCode and JetBrains IDEs:

{% install-nx-console /%}

![Nx Console screenshot](/shared/images/nx-console/nx-console-screenshot.webp)
