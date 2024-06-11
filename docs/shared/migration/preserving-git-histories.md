# Preserving Git Histories when Migrating other Projects to your Nx Workspace

The nature of a monorepo is to swallow up standalone projects as your organization buys into the benefits of a monorepo workflow.

As your monorepo consumes other projects though, it's important to ensure that git history for those projects is preserved inside of our Nx Workspace.

Git has some helpful tools for this, and we'll walk through some of the common pitfalls and gotchas of this task!

## Merging in a standalone project

To merge in another project, we'll essentially use the standard `git merge` command, but with a few lesser known options/caveats.

If your standalone project was not an Nx workspace, it's likely that your migration work will also entail moving directories to match a typical Nx Workspace structure. You can find more information in the [Manual migration](/recipes/adopting-nx/manual) page, but when migrating an existing project, you'll want to ensure that you use [`git mv`](https://git-scm.com/docs/git-mv) when moving a file or directory to ensure that file history from the old standalone repo is not lost!

In order to avoid merge conflicts later, it's best to first do the folder reorganization in the _standalone project repo_. For example, assuming you want the standalone app to end up at `apps/my-standalone-app` in the monorepo and your main branch is called `master`:

```shell
cd my-standalone-app
git fetch
git checkout -b monorepo-migration origin/master
mkdir -p apps/my-standalone-app
git ls-files | sed 's!/.*!!'| uniq | xargs -i git mv {} apps/my-standalone-app
git commit -m "Move files in preparation for monorepo migration"
git push -u
```

Next, in your monorepo, we'll add a remote repository url for where the standalone app is located:

```shell
git remote add my-standalone-app <repository url>
git fetch my-standalone-app
```

Then we'll run

```shell
git merge my-standalone-app/monorepo-migration --allow-unrelated-histories
```

Note that without the `--allow-unrelated-histories` option, the command would fail with the message: `fatal: refusing to merge unrelated histories`.
