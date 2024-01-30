# Reduce Wasted Time in CI

This article explores two ways that Nx improves the average speed of your CI pipeline - `nx affected` and remote caching. Using the `nx affected` command speeds up the first CI run for a PR and remote caching speeds up every CI run after that. Both `nx affected` and remote caching provide more benefits to repositories with more projects and a flatter project structure.

For this discussion, we'll assume you understand the Nx [mental model](/concepts/mental-model) and have an understanding of both [what the affected command is](/ci/features/affected) and [how caching works](/concepts/how-caching-works).

## Reduce Wasted Time With Affected

The `nx affected` command allows you to only run tasks on projects that were affected by a particular PR. This effectively eliminates the wasted time and resources that would have been spent executing tasks on projects that were unrelated to a particular PR.

How much benefit you gain from this is different for each repository, but there a few general principles that you can keep in mind as you're assessing the value of the Nx affected command for your repository. You can also use these principles to help inform your architecture decisions as you try to improve the performance of your CI system.

### Repos With More Projects Gain More Value From Affected

If we look at these two trivial examples, you can see that the repository with more projects gains more value from the affected command.

{% cards smCols="2" mdCols="2" lgCols="2" %}

{% graph title="One Project" height="200px" %}

```json
{
  "hash": "85fd0561bd88f0bcd8703a9e9369592e2805f390d04982fb2401e700dc9ebc59",
  "projects": [
    {
      "name": "project1",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "project1": [],
    "project2": [],
    "project3": []
  },
  "workspaceLayout": { "appsDir": "apps", "libsDir": "libs" },
  "affectedProjectIds": ["project1"],
  "focus": null,
  "groupByFolder": false,
  "exclude": []
}
```

{% /graph %}

{% graph title="Four Projects" height="200px" %}

```json
{
  "hash": "85fd0561bd88f0bcd8703a9e9369592e2805f390d04982fb2401e700dc9ebc59",
  "projects": [
    {
      "name": "project1",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "project2",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "project3",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "project4",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "project1": [],
    "project2": [],
    "project3": [],
    "project4": []
  },
  "workspaceLayout": { "appsDir": "apps", "libsDir": "libs" },
  "affectedProjectIds": ["project1"],
  "focus": null,
  "groupByFolder": false,
  "exclude": []
}
```

{% /graph %}

{% /cards %}

In the one project example, every PR will affect the entire repository. In the four project example, modifying one project only affects 25% of the repository. For the one project repository `nx affected -t build` is identical to `nx run-many -t build`, whereas for the four project repository, `nx affected -t build` cuts out the 75% of wasted work.

With this principle in mind, you can add more applications to the repository to gain the [benefits of a monorepo](https://monorepo.tools) without suffering an exponential increase in CI execution time. This principle also encourages splitting projects into multiple projects in order to have a faster CI pipeline for the existing applications.

### Flatter Repos Gain More Value From Affected

Consider the following example repo structures.

{% cards mdCols="3" lgCols="3" %}

{% graph title="Stacked" height="200px" %}

```json
{
  "hash": "85fd0561bd88f0bcd8703a9e9369592e2805f390d04982fb2401e700dc9ebc59",
  "projects": [
    {
      "name": "project1",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "project2",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "project3",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "project1": [{ "source": "project1", "target": "project2" }],
    "project2": [{ "source": "project2", "target": "project3" }],
    "project3": []
  },
  "workspaceLayout": { "appsDir": "apps", "libsDir": "libs" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false,
  "exclude": []
}
```

{% /graph %}

{% graph title="Grouped" height="200px" %}

```json
{
  "hash": "85fd0561bd88f0bcd8703a9e9369592e2805f390d04982fb2401e700dc9ebc59",
  "projects": [
    {
      "name": "project1",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "project2",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "project3",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "project1": [{ "source": "project1", "target": "project3" }],
    "project2": [{ "source": "project2", "target": "project3" }],
    "project3": []
  },
  "workspaceLayout": { "appsDir": "apps", "libsDir": "libs" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false,
  "exclude": []
}
```

{% /graph %}

{% graph title="Flat" height="200px" %}

```json
{
  "hash": "85fd0561bd88f0bcd8703a9e9369592e2805f390d04982fb2401e700dc9ebc59",
  "projects": [
    {
      "name": "project1",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "project2",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "project3",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "project1": [],
    "project2": [],
    "project3": []
  },
  "workspaceLayout": { "appsDir": "apps", "libsDir": "libs" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false,
  "exclude": []
}
```

{% /graph %}

{% /cards %}

If we assume that each project has an independent 50% chance of being modified on a given PR, we can calculate the expected average number of affected projects. Intuitively, the flat structure should have less affected projects than the stacked structure and the grouped structure should fall somewhere in between. That is, in fact, the case.

If we don't use the `nx affected` command in CI, no matter how our repo is structured, the expected number of projects run in CI will be 3 - all of them.

| Repo Structure | Expected Number of Affected Projects |
| -------------- | ------------------------------------ |
| Stacked        | 2.125                                |
| Grouped        | 2                                    |
| Flat           | 1.5                                  |

Note that the 50% chance of any project being modified is an arbitrary number. If we had picked a lower chance of being modified all the expected values would decrease as well. Every repository is different, but this illustrates that a flatter structure will help speed up your CI pipeline.

{% disclosure title="The Math Behind the Expected Number of Affected Projects" %}

**Definitions:**

ℙm(1) means the probability project 1 was modified  
ℙm'(1) means the probability project 1 was not modified  
ℙa(1) means the probability project 1 was affected

**Given:**

ℙm(1) = ℙm(2) = ℙm(3) = 0.5

**Stacked:**

ℙa(1) = ℙm(1) + ℙm'(1) \* ℙm(2) + ℙm'(1) \* ℙm'(2) \* ℙm(3) = 0.5 + 0.25 + 0.125 = 0.875  
ℙa(2) = ℙm(2) + ℙm'(2) \* ℙm(3) = 0.5 + 0.25 = 0.75  
ℙa(3) = ℙm(3) = 0.5 = 0.5

**Expected Number of Affected Projects:**  
ℙa(1) + ℙa(2) + ℙa(3) = 0.875 + 0.75 + 0.5 = 2.125

**Grouped:**

ℙa(1) = ℙm(1) + ℙm'(1) \* ℙm(3) = 0.5 + 0.25 = 0.75  
ℙa(2) = ℙm(2) + ℙm'(2) \* ℙm(3) = 0.5 + 0.25 = 0.75  
ℙa(3) = ℙm(3) = 0.5 = 0.5

**Expected Number of Affected Projects:**  
ℙa(1) + ℙa(2) + ℙa(3) = 0.75 + 0.75 + 0.5 = 2

**Flat:**

ℙa(1) = ℙm(1) = 0.5 = 0.5  
ℙa(2) = ℙm(2) = 0.5 = 0.5  
ℙa(3) = ℙm(3) = 0.5 = 0.5

**Expected Number of Affected Projects:**  
ℙa(1) + ℙa(2) + ℙa(3) = 0.5 + 0.5 + 0.5 = 1.5

{% /disclosure %}

## Reduce Wasted Time with Remote Caching

If you use a read/write token on developer machines, CI runs could be dramatically improved because they would be leveraging the work already done on the machine of the developer that pushed the PR. This set up requires you to have full trust in everyone who is capable of viewing the code base, which doesn't make sense for open source projects or for many organizations.

Remote caching is still valuable when only the CI pipelines have a read/write token.

### Remote Caching Begins Helping on the Second CI Run for a Pipeline

The first time CI runs for a particular PR, affected is doing most of the work to speed up your CI run. It is rare for a task to be cached on the first run. However, if the PR doesn't pass in CI, or if you need to make a change for some reason, subsequent runs of that same PR will be able to reuse cached tasks for you.

Take a look at the example below. The projects are setup in the suboptimal stacked arrangement from before. On the first CI run, `project3` was modified, so every project is affected. Then the developer realizes that `project2` should be changed as well and pushes a new commit. For the second CI run, every project is still affected when compared against the `main` branch, but `project3` hasn't changed between the first CI run and the second, so the cache from the first CI run can be used instead of re-running that task. `project2` tasks need to be re-run since it was modified and `project1` tasks need to be re-run since it depends on a project that was modified.

{% cards smCols="2" mdCols="2" lgCols="2" %}

{% graph title="First CI Run" height="200px" %}

```json
{
  "hash": "85fd0561bd88f0bcd8703a9e9369592e2805f390d04982fb2401e700dc9ebc59",
  "projects": [
    {
      "name": "project1",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "project2",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "project3",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "project1": [{ "source": "project1", "target": "project2" }],
    "project2": [{ "source": "project2", "target": "project3" }],
    "project3": []
  },
  "workspaceLayout": { "appsDir": "apps", "libsDir": "libs" },
  "affectedProjectIds": ["project1", "project2", "project3"],
  "focus": null,
  "groupByFolder": false,
  "exclude": []
}
```

{% /graph %}

{% graph title="Second CI Run (project2 Changed)" height="200px" %}

```json
{
  "hash": "85fd0561bd88f0bcd8703a9e9369592e2805f390d04982fb2401e700dc9ebc59",
  "projects": [
    {
      "name": "project1 ↩︎",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "project2 ↩︎",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "project3 ✓",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "project1 ↩︎": [{ "source": "project1 ↩︎", "target": "project2 ↩︎" }],
    "project2 ↩︎": [{ "source": "project2 ↩︎", "target": "project3 ✓" }],
    "project3 ✓": []
  },
  "workspaceLayout": { "appsDir": "apps", "libsDir": "libs" },
  "affectedProjectIds": ["project1 ↩︎", "project2 ↩︎", "project3 ✓"],
  "focus": null,
  "groupByFolder": false,
  "exclude": []
}
```

{% /graph %}

{% /cards %}

### Caching Provides More Value When There are More Projects and a Flatter Structure

The exact same reasoning that lead us to encourage more projects and a flatter structure to gain value from the affected command, also applies to caching.

If there is a single project in a repo, the cache will be broken on 100% of changes. If there are 4 unconnected projects, changing one project, allows you to use the cache for the other 3 projects.

Just as modifying a project makes projects that depend on it be `affected`, modifying a project also breaks the cache for projects that depend on it.
