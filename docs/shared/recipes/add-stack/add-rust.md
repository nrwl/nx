---
title: Add a New Rust Project
description: Learn how to integrate Rust with Nx using the @monodon/rust plugin, including creating applications, libraries, and leveraging Nx features.
---

# Add a New Rust Project

The code for this example is available on GitHub:

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/rust" /%}

**Supported Features**

We'll be using an Nx Plugin for Rust
called [@monodon/rust](https://github.com/cammisuli/monodon/tree/main/packages/rust).

{% pill url="/features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/ci/features/remote-cache" %}✅ Share Your Cache{% /pill %}
{% pill url="/features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/ci/features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/getting-started/editor-setup" %}✅ Integrate with Editors{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/features/enforce-module-boundaries" %}✅ Enforce Module Boundaries{% /pill %}
{% pill url="/features/generate-code" %}✅ Use Code Generators{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Framework Dependencies{% /pill %}

## Create the workspace with the `@monodon/rust` preset

We'll use the preset created by the `@monodon/rust` plugin to create the workspace with everything we need to build Rust
applications.

{% tabs %}
{%tab label="npm"%}

```shell
npx -y create-nx-workspace@latest acme --preset=@monodon/rust
```

{% /tab %}
{%tab label="yarn"%}

```shell
npx -y create-nx-workspace@latest acme --preset=@monodon/rust --packageManager=yarn
```

{% /tab %}
{%tab label="pnpm"%}

```shell
npx -y create-nx-workspace@latest acme --preset=@monodon/rust --packageManager=pnpm
```

{% /tab %}
{% /tabs %}

Using the preset provided by `@monodon/rust` will:

- Remove any unnecessary configuration files for working with Rust projects, such as `tsconfig.json` and `.prettierrc`
- Remove unnecessary dependencies, such as `@nx/js`, as we're working with a Rust project
- Add a root `Cargo.toml` to manage workspace members

## Create the application

Let's generate a new application using `@monodon/rust`.

```shell
nx g @monodon/rust:binary myapp --directory=apps/myapp
```

## Create a library

Let's generate a new library using `@monodon/rust`.

```shell
nx g @monodon/rust:library cats --directory=libs/cats
```

## Update the `cats` library

First, let's update the `Cargo.toml` file to define the dependencies for the library.

```toml {% fileName="libs/cats/Cargo.toml" %}
[package]
name = "cats"
version = "0.1.0"
edition = "2021"

[dependencies]
actix-web = "4"

[dependencies.serde]
version = "1"
features = ["derive"]

# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
```

Now, let's add the code to handle the `cats` route.

```rust {% fileName="libs/cats/src/lib.rs" %}
use std::collections::HashSet;
use std::sync::Mutex;

use actix_web::web::*;
use actix_web::{get, post, HttpResponse, Responder, Scope};

pub struct Cats {
    cats: Mutex<HashSet<Cat>>,
}

#[derive(Eq, Hash, PartialEq, Clone, Debug, serde::Deserialize, serde::Serialize)]
struct Cat {
    name: String,
    age: u8,
}

#[get("")]
async fn get_cats(data: Data<Cats>) -> impl Responder {
    let cats = data.cats.lock().unwrap();

    println!("Cats {:?}", &cats);

    Json(cats.clone())
}

#[post("/add")]
async fn add_cat(cat: Json<Cat>, data: Data<Cats>) -> impl Responder {
    let mut cats = data.cats.lock().unwrap();

    println!("Adding {:?}", &cat);

    cats.insert(cat.into_inner());

    HttpResponse::Ok()
}

pub fn create_cat_data() -> Data<Cats> {
    Data::new(Cats {
        cats: Mutex::new(HashSet::new()),
    })
}

pub fn create_cat_scope(data: &Data<Cats>) -> Scope {
    scope("/cats")
        // Cloning is cheap here because internally, Data uses `Arc`
        .app_data(Data::clone(data))
        .service(add_cat)
        .service(get_cats)
}

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}

```

## Update the application

Let's create the http-server application and use the library to add the `cats` route.

First, we need to update the `Cargo.toml` file to define the application's dependencies.

```toml {% fileName="apps/myapp/Cargo.toml" %}
[package]
name = "myapp"
version = "0.1.0"
edition = "2021"


[dependencies]
actix-web = "4"
cats = { path = "../../libs/cats" }


# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html

```

Now, let's update the application's code itself.

```rust {% fileName="apps/myapp/src/main.rs" %}
use actix_web::{App, HttpServer};

use cats::{create_cat_data, create_cat_scope};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // HttpServer:new creates multiple threads to handle requests.
    // We need to make sure that the shared cat data is created once before the HttpServer
    // We can then pass this reference to the create_cat_scope so that all threads have access to the same data
    let cat_data = create_cat_data();
    HttpServer::new(move || App::new().service(create_cat_scope(&cat_data)))
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
}

```

## Build and Run the Application

To run the application, run the following command and then navigate your browser to `http://localhost:8080/cats`

```shell
nx run myapp:run
```

To build the application, run the following command:

```shell
nx build myapp
```

## More Documentation

- [Rust](https://www.rust-lang.org/)
- [@monodon/rust](https://github.com/cammisuli/monodon/tree/main/packages/rust)
