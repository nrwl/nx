# Configuring Browser Support

The official Nx plugins rely on [browserslist](https://github.com/browserslist/browserslist) for configuring application browser support. This affects builds, both production and development, and will decide on which transformations will be run on the code when built.

In general, the more modern your applications browser support is, the smaller the filesize as the code can rely on modern API's being present and not have to ship polyfills or shimmed code.

By default, applications generated from official Nx generators ship an aggressively modern browser support config, in the form of a `.browserslistrc` file in the root of the application with the following contents.

```text
last 1 Chrome version
last 1 Firefox version
last 2 Edge major versions
last 2 Safari major version
last 2 iOS major versions
Firefox ESR
not IE 9-11
```

This configuration is used for many tools including babel, autoprefixer, postcss, and more to decide which transforms are necessary on the source code when producing built code to run in the browser.

For additional information regarding the format and rule options, please see: https://github.com/browserslist/browserslist#queries

## Debugging Browser Support

Sometimes broad configurations like `> 0.5%, not IE 11` can lead to surprising results, due to supporting browsers like Opera Mini or Android UC browser.

To see what browsers your configuration is supporting, run `npx browserslist` in the application's directory to get an output of browsers and versions to support.

```{% command="npx browserslist" %}
and_chr 61
chrome 83
edge 83
edge 81
firefox 78
firefox 68
ie 11
ios_saf 13.4-13.5
ios_saf 13.3
ios_saf 13.2
ios_saf 13.0-13.1
ios_saf 12.2-12.4
ios_saf 12.0-12.1
safari 13.1
safari 13
safari 12.1
safari 12
```

Alternatively, if your support config is short you can just add it as a string param on the CLI:

```shell
npx browserslist '> 0.5%, not IE 11'
```
