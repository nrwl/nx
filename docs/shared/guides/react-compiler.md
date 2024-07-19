# React Compiler with Nx

React 19 comes with an experimental compiler that optimizes application code to automatically memoize code. Read the [official React Compiler documentation](https://react.dev/learn/react-compiler) for more information.

## Enabling React Compiler in Nx Projects

For Nx projects using Babel and the `@nx/react/babel` preset, install the `babel-plugin-react-compiler` package and enable it with the `reactCompiler` option.

```json {% highlightLines=[7] %}
{
  "presets": [
    [
      "@nx/react/babel",
      {
        "runtime": "automatic",
        "reactCompiler": true
      }
    ]
  ],
  "plugins": []
}
```

You can also pass an object to set compiler options.

```json {% highlightLines=["7-9"] %}
{
  "presets": [
    [
      "@nx/react/babel",
      {
        "runtime": "automatic",
        "reactCompiler": {
          "compilationMode": "annotation"
        }
      }
    ]
  ],
  "plugins": []
}
```

Check the [React Compiler usage docs](https://react.dev/learn/react-compiler#installation) for all support setups, such as Vite, Remix, etc.
