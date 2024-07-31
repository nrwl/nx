---
title: 'Debugging Nx in VS Code'
slug: 'debugging-nx-in-vs-code'
authors: ['Torgeir Helgevold']
cover_image: '/blog/images/2019-04-09/1*glqkXXIj3Mpms5Oo3_XDIA.png'
tags: [nx, release]
---

It’s a common practice for developers to rely on console.log when troubleshooting their code, but for complex scenarios, attaching a debugger might be more effective. In this article we will show how to set up debugging for both Nx Node applications and Nx Jest libs in VS Code.

### **Be sure to sign-up to Nrwl’s Live Broadcast all about Nx!** [**https://go.nrwl.io/nrwl-connect-live-nx-toronto**](https://go.nrwl.io/nrwl-connect-live-nx-toronto)

## Jest

Jest has become a very popular testing framework, but unlike Karma, Jest doesn’t execute in a browser. This means there is no built in debugger. Instead we have to attach a debugger to the underlying node process that runs the tests. In the following sections we will show you how.

### Attaching the debugger

To use the debugger the first thing we have to do is add some configuration in VS code that will allow us to attach to the node process where Jest is running.

Under the .vscode folder at the root of the workspace, create a file called launch.json and add the following json:

When you launch the debugger this will execute the command **ng test lib-name** and attach to the underlying Jest process. In this case we are debugging an Nx lib called cars.

Disabling code coverage using **— codeCoverage=false** is important since code coverage interferes with the ability to step through code in the debugger. We also have to limit the scope of the test run to a single file using **— testFile**. Otherwise the debugger won’t stop on breakpoints. You can optionally specify a testName pattern to limit debugging to a single fixture in the specified test file. In this example we are only debugging tests in the CarService fixture in cars.service.spec.ts.

**Please note:** In your own workspace you must replace cars, testNamePattern and testFile with values from your own workspace.

The debugger can be launched by clicking the green “play” button seen below:

![](/blog/images/2019-04-09/0*BsLuDcUhGJHZjIO-.avif)

After the debugger is launched you will be able to step through the code as seen in the screenshot below:

![](/blog/images/2019-04-09/0*ROOGHdzICdS5hv2j.avif)

## Node Applications

Debugging Node applications is more straightforward than Jest libs since we’re dealing with just a single entry point. With Jest we had to narrow down the scope to a particular test file, but in Node, all we have to do is attach to a running Node process.

### Running Node in Debug Mode

Before attaching we have to make sure the Node process runs in debug mode. Luckily Nx exposes an inspect flag that will ensure that the process starts up with debugging enabled. Flipping the inspect flag to true in the serve section in angular.json launches the debugger on port 7777 when the Nx Node application is started.

Here is an example from angular.json:

### Attaching the Debugger

Similar to the Jest example, we need an entry in launch.json to tell VS Code how to attach to the running Node process.

In the example configuration below we tell VS Code to attach to the debugger process running on port 7777. This is the default port used by Nx when launching Node applications in debug mode. Please note that port 7777 is only used by the debugger. It doesn’t change the port used to run the actual Node application.

Again, the debugger can be launched by clicking the green “play” button, but we now have to also select the correct config entry from the dropdown next to the button. In our example we named the entry in launch.json “Debug Node App”.

See the screenshot below:

![](/blog/images/2019-04-09/0*ckHTznawPzMBPv92.avif)

## Complete launch.json

For completeness we are listing the complete launch.json with both entries below:

[**Torgeir**](https://twitter.com/helgevold) **is an Angular Architect at** [**Nrwl**](https://nrwl.io/)**.** _Follow_ [_@helgevold_](https://twitter.com/helgevold) _and_ [**_Nrwl.io_**](https://medium.com/@nrwl_io) _to read more about Angular._

![](/blog/images/2019-04-09/0*cwhdETxwq79C3zpO.avif)

_Be sure to download our new book at_ [_go.nrwl.io/monorepo_](http://go.nrwl.io/monorepo)
