# What is Nx Cloud?

{% youtube
src="https://www.youtube.com/embed/NZF0ZJpgaJM?si=1KJRAWJJmfw9c0c0"
title="What is Nx Cloud?"
width="100%" /%}

Nx partitions a command into smaller tasks and runs them in parallel, in the correct order. Nx Cloud takes it one step further and [runs any command across multiple machines](/core-features/distribute-task-execution), while giving you a consolidated view of the command as if it ran locally.

Nx caches the output of any previously run command such as testing and building, so it can replay the cached results instead of rerunning it. Nx Cloud allows you to [share the computation cache](/core-features/remote-cache) across everyone in your team and CI.

And it takes five minutes to set up.

{% personas %}
{% persona type="cache" title="Share Your Cache" url="/core-features/remote-cache" %}
Share the computation cache across CI and developer machines

- [Set up distributed caching](/core-features/remote-cache)

{% /persona %}

{% persona type="distribute" title="Distribute Tasks in CI" url="/core-features/distribute-task-execution" %}

Improve the worst case CI build by efficiently parallelizing tasks

- [Set up distributed task execution](/core-features/distribute-task-execution)

{% /persona %}
{% /personas %}

## Clean User Interface

Most developers will benefit from Nx Cloud without ever-changing any of their workflow. Commands will just execute faster. For those developers that are tasked with making the most of Nx Cloud or those that want to get more insight into the different commands executed in the repository, Nx Cloud has a clean, informative user interface.

Take a look at the [Nx repo's Nx Cloud dashboard](https://nx.app/orgs/5e38af6de037b5000598b2d6/workspaces/5edaf12087863a0005781f17) for a real world example of how Nx Cloud is saving us CI time.
