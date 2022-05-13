# Nx Cloud
## Save Time With Distributed Task Execution & Cache
Nx partitions a command into smaller tasks and runs them in parallel, in the correct order. Nx Cloud takes it one step further and [runs any command across multiple machines](/nx-cloud/intro/distributed-task-execution), while giving you a consolidated view of the command as if it ran locally.

Nx caches the output of any previously run command such as testing and building, so it can replay the cached results instead of rerunning it. Nx Cloud allows you to [share the computation cache](/nx-cloud/intro/distributed-caching) across everyone in your team and CI.

No configuration needed.

## Clean User Interface

Most developers will benefit from Nx Cloud without ever changing any of their workflow.  Commands will just execute faster.  For those developers that are tasked with making the most of Nx Cloud or those that want to get more insight into the different commands executed in the repository, Nx Cloud has a clean, informative user interface.

The top level organization page displays recent runs and a helpful dashboard of information about commands run in the repository.

<iframe src="https://nx.app/orgs/5e38af6de037b5000598b2d6/workspaces/5edaf12087863a0005781f17">

Each branch in the repository has its own dedicated page where you can view agent utilization and a waterfall task execution graph for the most recent runs against that branch.

<iframe src="https://nx.app/branch?workspaceId=5edaf12087863a0005781f17&branchName=master">
