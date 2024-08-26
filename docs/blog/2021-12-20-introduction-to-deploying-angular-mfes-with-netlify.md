---
title: 'Introduction to Deploying Angular Micro Frontends with Netlify'
slug: 'introduction-to-deploying-angular-mfes-with-netlify'
authors: ['Colum Ferry']
cover_image: '/blog/images/2021-12-20/1*pOWiZcC6kbhpD2tBw2qD7A.png'
tags: [nx, tutorial]
---

This series of articles will aim to showcase the process of scaffolding and deploying a Micro Frontend Architecture using Nx and [Netlify](https://netlify.com/).

### Articles in this series

- **Introduction to Deploying MFEs with Netlify**
- [Scaffold and Deploy the Dashboard to Netlify](/blog/scaffold-and-deploy-the-dashboard-to-netlify)
- [Build and Deploy the Remote Applications to Netlify](/blog/build-and-deploy-the-remote-applications-to-netlify)
- [Integrate the Remote apps with the Dashboard](/blog/integrate-the-remote-apps-with-the-dashboard)

## What we’ll build

Here is a short video introducing this series of articles and showcasing what we’ll build.

It’s a pretty straightforward system consisting of three independently deployed applications, with one composing the other two into a complete system, taking full advantage of [Module Federation](https://webpack.js.org/concepts/module-federation/) to do so.

**We’ll build:**

- A login application
- A “todo” application (it won’t function, just serve as a placeholder)
- A dashboard application (which will combine the above two MFEs!)

**How we’ll build it:**

- Use Nx’s MFE generators to scaffold out the architecture with Angular
- Use Nx for increased developer experience as we build each application
- Link the applications in the Dashboard’s webpack config
- Deploy to Netlify

We’ll cover what Micro Frontends (MFEs) are, some terminology that you’ll see a lot, what Netlify is and how to use it in this context, and, finally, we’ll scaffold out the applications that will complete the architecture. Let’s dive in!

## What are MFEs?

In short, Micro Frontend Architecture is the composition of multiple, independently-deployed frontend applications into a single application.

It can help to picture this in the scenario that allows multi-development team organisations to focus on their own application, giving them more autonomy over their application’s direction and release schedule. This application can then be used by other teams easily.

It’s like super-charged iframes but with more securities and benefits along for the ride.

_Note: If you’d like a fuller definition, you can read more at_ [_micro-frontends.org_](https://micro-frontends.org)

## What is Netlify?

In their own words, Netlify is a web developer platform that multiplies productivity. It is an all-in-one platform for automating modern web projects. It does this by replacing your hosting infrastructure, CI and CD pipeline with a single workflow. It’s as easy as signing up and pointing a new project at a GitHub repository and telling Netlify your build command and the output location of your built files. Netlify will handle the rest.

In layman’s terms, it allows you to deploy JAMStack sites to their network more efficiently. It comes with many benefits that are beyond the scope of this article. Things like Edge Networking using an advanced CDN that ensures accurate and up-to-date versions of your site by invalidating worldwide caches, the ability to deploy Serverless Functions alongside your application on the same platform and powerful integrations. It’s worth checking out their [site](https://www.netlify.com/products) to learn more about what they offer.

We’ll use their platform to deploy our Micro Frontend Applications because they essentially make it super simple to do so!

## Setup our Nx MFE Workspace

Before we begin, ensure you have [Yarn](https://yarnpkg.com/) installed, as it will resolve the webpack dependencies better for Module Federation.

We’ll start by creating an empty Nx workspace:

```shell
npx create-nx-workspace@latest mfe-netlify --preset=empty --no-nxCloud --packageManager=yarn
```

This will create a new Nx Workspace in a new folder named _\`mfe-netlify\`_. Run _\`cd mfe-netlify\`_ to enter the folder and you’ll see a Git repository has been created for you.

Next, we’ll add the [Official Angular Plugin for Nx](/nx-api/angular) to our workspace.

```shell
yarn add @nrwl/angular
```

Let’s commit it to our repository.

```
git commit -am “chore: add nrwl angular dep”
```

Next, you’ll want to push your local repository to your [GitHub](https://github.com/) account.  
_NOTE: You can read how to do that here:_ [_https://docs.github.com/en/github/importing-your-projects-to-github/importing-source-code-to-github/adding-an-existing-project-to-github-using-the-command-line_](https://docs.github.com/en/github/importing-your-projects-to-github/importing-source-code-to-github/adding-an-existing-project-to-github-using-the-command-line)

The final step in this article is to get your Netlify account ready.

![](/blog/images/2021-12-20/1*OwSzYroLzsE4w6EEdMgcJA.avif)

This will leave us in a good place to build out and deploy our solution. If you don’t already have a Netlify account, follow the instructions below:

1.  Go to [https://app.netlify.com/](https://app.netlify.com/)
2.  Login using GitHub
3.  Follow the on-screen instructions, filling out the Get started form
4.  After submitting the form, click on \`Skip this step for now\`, below \`Deploy your first project\`.
5.  You’re all set to go!

## Where next?

We’re in an excellent position now to build out and deploy each application in our Micro Frontend Architecture. We have our Nx Workspace, our GitHub Repository and our Netlify account, all ready to make some magic happen.

The following article in this series will focus on scaffolding our MFE-ready Dashboard application and deploying it to Netlify. Keep an eye on our blog and Twitter pages to be notified when it gets released. You can find links to these below.

Blog: [https://nx/dev/blog/](/blog)  
Nx on Twitter: [https://twitter.com/NxDevTools](https://twitter.com/NxDevTools)  
Colum Ferry’s Twitter: [https://twitter.com/FerryColum](https://twitter.com/FerryColum)
