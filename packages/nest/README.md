<p style="text-align: center;"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx.png" width="600" alt="Nx - Smart, Extensible Build Framework"></p>

{{links}}

<hr>

# Nest.js Plugin for Nx

{{what-is-nx}}

{{getting-started}}

```
? Workspace name (e.g., org name)     happyorg
? What to create in the new workspace nest
? Application name                    myapp
? Default stylesheet format           CSS
```

You can also select `empty` and add `@nrwl/nest` plugin using yarn or npm, and then generate a new express app using `nx g @nrwl/nest:app myapp`.

If it's your first Nx project, the command will recommend you to install the `nx` package globally, so you can invoke `nx` directly without going through yarn or npm.

### Serving Application

- Run `nx serve myapp` to serve the newly generated application!
- Run `nx test myapp` to test it.

You are good to go!

{{resources}}
