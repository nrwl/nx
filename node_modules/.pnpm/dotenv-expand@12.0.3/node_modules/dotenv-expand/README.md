<div align="center">
🎉 announcing <a href="https://github.com/dotenvx/dotenvx">dotenvx</a>. <em><b>expansion AND command substitution</b>, multi-environment, encrypted envs, and more</em>.
</div>

&nbsp;

<div align="center">

**Special thanks to [our sponsors](https://github.com/sponsors/motdotla)**

<a href="https://tuple.app/dotenv">
  <div>
    <img src="https://res.cloudinary.com/dotenv-org/image/upload/w_1000,ar_16:9,c_fill,g_auto,e_sharpen/v1756831704/github_repo_sponsorship_gq4hvx.png" width="600" alt="Tuple">
  </div>
  <b>Tuple, the premier screen sharing app for developers on macOS and Windows.</b>
</a>
<hr>
</div>

# dotenv-expand [![NPM version](https://img.shields.io/npm/v/dotenv-expand.svg?style=flat-square)](https://www.npmjs.com/package/dotenv-expand)

<img src="https://raw.githubusercontent.com/motdotla/dotenv-expand/master/dotenv-expand.png" alt="dotenv-expand" align="right" width="200" />

Dotenv-expand adds variable expansion on top of [dotenv](http://github.com/motdotla/dotenv). If you find yourself needing to expand environment variables already existing on your machine, then dotenv-expand is your tool.

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)
[![LICENSE](https://img.shields.io/github/license/motdotla/dotenv-expand.svg)](LICENSE)
[![codecov](https://codecov.io/gh/motdotla/dotenv-expand/graph/badge.svg?token=pawWEyaMfg)](https://codecov.io/gh/motdotla/dotenv-expand)

## Install

```bash
# Install locally (recommended)
npm install dotenv-expand --save
```

Or installing with yarn? `yarn add dotenv-expand`

## Usage

Create a `.env` file in the root of your project:

```dosini
PASSWORD="s1mpl3"
DB_PASS=$PASSWORD
```

As early as possible in your application, import and configure dotenv and then expand dotenv:

```javascript
const dotenv = require('dotenv')
const dotenvExpand = require('dotenv-expand')

dotenvExpand.expand(dotenv.config())

console.log(process.env) // remove this after you've confirmed it is expanding
```

That's it. `process.env` now has the expanded keys and values you defined in your `.env` file.

```
dotenvExpand.expand(dotenv.config())

...

connectdb(process.env.DB_PASS)
```

### Preload

> Note: Consider using [`dotenvx`](https://github.com/dotenvx/dotenvx) instead of preloading. I am now doing (and recommending) so.
> 
> It serves the same purpose (you do not need to require and load dotenv), has built-in expansion support, adds better debugging, and works with ANY language, framework, or platform. – [motdotla](https://github.com/motdotla)

You can use the `--require` (`-r`) [command line option](https://nodejs.org/api/cli.html#cli_r_require_module) to preload dotenv & dotenv-expand. By doing this, you do not need to require and load dotenv or dotenv-expand in your application code. This is the preferred approach when using `import` instead of `require`.

```bash
$ node -r dotenv-expand/config your_script.js
```

The configuration options below are supported as command line arguments in the format `dotenv_config_<option>=value`

```bash
$ node -r dotenv-expand/config your_script.js dotenv_config_path=/custom/path/to/your/env/vars
```

Additionally, you can use environment variables to set configuration options. Command line arguments will precede these.

```bash
$ DOTENV_CONFIG_<OPTION>=value node -r dotenv-expand/config your_script.js
```

```bash
$ DOTENV_CONFIG_ENCODING=latin1 node -r dotenv-expand/config your_script.js dotenv_config_path=/custom/path/to/.env
```

## Examples

See [tests/.env.test](https://github.com/motdotla/dotenv-expand/blob/master/tests/.env.test) for simple and complex examples of variable expansion in your `.env`
file.

## Documentation

`dotenv-expand` exposes one function:

* expand

### Expand

`expand` will expand your environment variables.

```js
const env = {
  parsed: {
    BASIC: 'basic',
    BASIC_EXPAND: '${BASIC}',
    BASIC_EXPAND_SIMPLE: '$BASIC'
  }
}

console.log(dotenvExpand.expand(env))
```

#### Options

##### processEnv

Default: `process.env`

Specify an object to write your secrets to. Defaults to `process.env` environment variables.

```js
const myEnv = {}
const env = {
  processEnv: myEnv,
  parsed: {
    HELLO: 'World'
  }
}
dotenvExpand.expand(env)

console.log(myEnv.HELLO) // World
console.log(process.env.HELLO) // undefined
```

## FAQ

### What rules does the expansion engine follow?

See a full list of rules [here](https://dotenvx.com/docs/env-file#interpolation).

### How can I avoid expanding pre-existing envs (already in my `process.env`, for example `pas$word`)?

As of `v12.0.0` dotenv-expand no longer expands `process.env`.

If you need this ability, use [dotenvx](https://github.com/dotenvx/dotenvx) by shipping an encrypted .env file with your code - allowing safe expansion at runtime.

### How can I override an existing environment variable?

Use [dotenvx](https://github.com/dotenvx/dotenvx) as dotenv-expand does not support this.

dotenv-expand is a separate module (without knowledge of the loading of `process.env` and the `.env` file) and so cannot reliably know what to override.

## Contributing Guide

See [CONTRIBUTING.md](CONTRIBUTING.md)

## CHANGELOG

See [CHANGELOG.md](CHANGELOG.md)

## Who's using dotenv-expand?

[These npm modules depend on it.](https://www.npmjs.com/browse/depended/dotenv-expand)
