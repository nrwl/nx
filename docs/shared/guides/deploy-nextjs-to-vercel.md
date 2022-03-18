# Deploying Next.js applications to Vercel

Starting from Nx 11, your Next.js application should already be ready for deployment to Vercel.

## Configure your Vercel project's settings appropriately

### New Vercel project

1. If you are "importing" your Nx workspace's repository for the first time, make sure you do _not_ choose a root directory as part of the repo selection process (therefore leaving it to be the root of the full repo/workspace)
2. Ensure the Next.js "Framework Preset" is selected
3. Expand the "Build and Output Settings" and toggle the override switch for the build command. For example, for an application named `tuskdesk` the value will look like this:

```bash
npx nx build tuskdesk --prod
```

4. Toggle the override switch for the output directory. Point it to the `.next` directory inside the built app:

```bash
dist/apps/tuskdesk/.next
```

Therefore, our full configuration (based on a repo called "nx-workspace" and a project called "tuskdesk") will look like this:

![New Vercel Project](/shared/guides/next-deploy-vercel-1.png)

### Existing Vercel project

If you have an existing project on Vercel then the exact same guidance applies as for the section above, it's just that you will need to update the project's existing settings.

When everything is updated appropriately, for our `tuskdesk` example we would see the following in our "General" settings UI:

![Existing Vercel Project](/shared/guides/next-deploy-vercel-2.png)

## Skipping build if the application is not affected

One of the core features of Nx is to run code quality checks and builds only for projects that are affected by recent code changes. We can use [Vercel's ignored build step feature](https://vercel.com/docs/platform/projects#ignored-build-step) to only build our application if it is affected.

We are going to achieve this by creating a shell script in our Nx workspace that will be invoked by Vercel.

```sh

# Name of the app to check. Change this to your application name!
APP=tuskdesk

# Determine version of Nx installed
NX_VERSION=$(node -e "console.log(require('./package.json').devDependencies['@nrwl/workspace'])")
TS_VERSION=$(node -e "console.log(require('./package.json').devDependencies['typescript'])")

# Install @nrwl/workspace in order to run the affected command
npm install -D @nrwl/workspace@$NX_VERSION --prefer-offline
npm install -D typescript@$TS_VERSION --prefer-offline

# Run the affected command, comparing latest commit to the one before that
npx nx affected:apps --plain --base HEAD~1 --head HEAD | grep $APP -q

# Store result of the previous command (grep)
IS_AFFECTED=$?

if [ $IS_AFFECTED -eq 1 ]; then
  echo "🛑 - Build cancelled"
  exit 0
elif [ $IS_AFFECTED -eq 0 ]; then
  echo "✅ - Build can proceed"
  exit 1
fi
```

There are a few points worth noting about this script.

Firstly, you might have noticed that we are running `npm install` (feel free to use `yarn add` instead) in this script, as a result running it will take some time. Having said that, it is usually still much faster than installing all dependencies and running the build of your application unconditionally.

Secondly, this script only compares changes introduced in a single latest commit. So if you push multiple new commits - the script will only check if your application is affected by changes in the latest commit. In the future, there should be an environment variable in Vercel to determine what the base for the affected comparison should be.

Once you've saved this script in your Nx workspace, for example in `tools/ignore-vercel-build.sh`, we need to point Vercel to use this script.

Remember to add `sh` before the script to avoid `Permission denied`.

```sh
sh ./tools/ignore-vercel-build.sh
```

![Ignore build step](/shared/guides/next-deploy-vercel-3.png)

Naturally, you can continue on and set any additional Environment Variables etc that may be appropriate for your projects, but we have now covered the key points needed to deploy Next.js projects from Nx workspaces on Vercel!
