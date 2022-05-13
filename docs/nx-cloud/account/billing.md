# Billing and Utilization

When connected to Nx Cloud, every workspace can start using the Distributed Computation Cache and Distributed Task Execution right away, without having to set up any billing information.

However, some large workspaces or those using Nx Private Cloud will need to have a subscription set up.

## Time Saved / Utilization

Nx Cloud bills your account based on how much benefit you get from using the Distributed Computation Cache and Distributed Task Execution.

To assess the benefit, Nx Cloud calculates "time saved". Of course, task times can vary substantially depending on which machine runs the task or what else is running on that machine. And there are many ways to implement your own distribution setups. There is no way to know how much time actually was saved without running the commands. So the calculation performed by Nx Cloud is simply an estimate of the provided benefit.

Nx Cloud does the following to compute "time saved".

### Distributed Computation Cache

Nx Cloud subtracts the runtime of retrieving a cached task from the amount of time it took to run the task without the cache. For example, if a task takes 5 minutes to run normally, but 10 seconds to restore it from the Nx Cloud cache, the time saved is 4 minutes and 50 seconds.

### Distributed Task Execution

Nx Cloud sums up the normal runtimes of all tasks invoked during a DTE, then subtracts the runtime of the DTE from the sum, and divides it by 2. For example, if the total runtime of all tasks is 3 hours when executed normally, and the same tasks run with DTE enabled in 20 minutes, then DTE has saved 1h 20 mins = (3 hours - 20 mins) / 2.

We divide the savings by 2 because we assume you would have set up some form of distribution. We cannot know what your distribution setup could have looked like, but in our experience Nx helps to distribute the work across agents more evenly and helps implement more interesting CI scenarios, which results in substantially faster CI times.

## Flat Pricing

Some organizations prefer flat pricing because of its predictability, and this is available with Nx Enterprise. Please [fill in this form](https://go.nrwl.io/nx-cloud-feedback-private-cloud) to find out more information.

## Coupons and Subscriptions

If you use the public version of Nx Cloud or Nx Private Cloud, there are two ways to set up billing:

1. You can purchase credit using a credit card. This is useful if you want to try Nx Cloud for a longer period of time or if you run out of Nx Cloud credits.
2. You can set up a subscription with a monthly spending limit. If you reach the limit, the Distributed Computation Cache and Distributed Task Execution features will be paused until the next billing cycle. Both the credit card and invoice payment methods are supported.
