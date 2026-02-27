## Examples

The `setup-mf` generator is used to add Module Federation support to existing applications.

##### Convert to Host

To convert an existing application to a host application, run the following

```bash
nx g setup-mf myapp --mfType=host --routing=true
```

##### Convert to Remote

To convert an existing application to a remote application, run the following

```bash
nx g setup-mf myapp --mfType=remote --routing=true
```

##### Convert to Remote and attach to a host application

To convert an existing application to a remote application and attach it to an existing host application name `myhostapp`, run the following

```bash
nx g setup-mf myapp --mfType=remote --routing=true --host=myhostapp
```

##### Convert to Host and attach to existing remote applications

To convert an existing application to a host application and attaching existing remote applications named `remote1` and `remote2`, run the following

```bash
nx g setup-mf myapp --mfType=host --routing=true --remotes=remote1,remote2
```
