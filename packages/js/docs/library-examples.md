## Examples

{% tabs %}

{% tab label="Using directory flag" %}

Generate a library named `mylib` and put it under a directory named `myapp` (`libs/myapp/mylib`)

```shell
npx nx g lib mylib --directory=myapp
```

{% /tab %}

{% tab label="Use SWC compiler" %}

Generate a library using [SWC](https://swc.rs) as the compiler

```shell
npx nx g lib mylib --compiler=swc
```

{% /tab %}

{% tab label="Minimal publishing target" %}

Generate a **publishable** library with a minimal publishing target

```shell
npx nx g lib mylib --publishable
```

{% /tab %}

{% /tabs %}
