<p style="text-align: center;"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-react.png" width="600" alt="Nx - Smart, Extensible Build Framework"></p>

{{links}}

<hr>

# React Plugin for Nx

{{what-is-nx}}

{{getting-started}}

```
? Workspace name (e.g., org name)     happyorg
? What to create in the new workspace react    [a workspace with a single React application]
? Application name                    myapp
? Default stylesheet format           CSS
```

If it's your first Nx project, the command will recommend you to install the `nx` package globally, so you can invoke `nx` directly without going through yarn or npm.

### Serving Application

- Run `nx serve myapp` to serve the newly generated application!
- Run `nx test myapp` to test it.
- Run `nx e2e myapp-e2e` to run e2e tests for it.

### Adding React Plugin Into an Existing Workspace

You can always add the React plugin to an existing workspace by installing `@nrwl/react` and then generating an React application, as follows: `nx g @nrwl/react:app myapp`.

## Quick Start Videos

<a href="https://www.youtube.com/watch?v=E188J7E_MDU" target="_blank">
<p style="text-align: center;"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-react-video.png" width="350" alt="Nx - Quick start video"></p>
</a>

- [Nx Dev Tools for Monorepos, In-Depth Explainer (React)](https://www.youtube.com/watch?v=jCf92IyR-GE)

{{resources}}
