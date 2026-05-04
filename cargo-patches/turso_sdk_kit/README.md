# Turso SDK kit

Low-level, SQLite-compatible Turso API to make building SDKs in any language simple and predictable. The core logic is implemented in Rust and exposed through a small, portable C ABI (turso.h), so you can generate language bindings (e.g. via rust-bindgen) without re-implementing database semantics.

Key ideas:
- Async I/O: opt-in caller-driven I/O (ideal for event loops or io_uring), or library-driven I/O.
- Clear status codes: Done/Row/Io/Error/etc. No hidden blocking or exceptions.
- Minimal surface: open database, connect, prepare, bind, step/execute, read rows, finalize.
- Ownership model and lifetimes are explicit for C consumers.

Note: turso.h is the single C header exported by the crate and can be translated to bindings.rs with rust-bindgen.

## Rust example

```rust
use turso_sdk_kit::rsapi::{
    TursoDatabase, TursoDatabaseConfig, TursoStatusCode, Value, ValueRef,
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create the database holder (not opened yet).
    let db = TursoDatabase::create(TursoDatabaseConfig {
        path: ":memory:".to_string(),
        experimental_features: None,
        io: None,
        // When true, step/execute may return Io and you should call run_io() to progress.
        async_io: true,
    });

    // Open and connect.
    db.open()?;
    let conn = db.connect()?;

    // Prepare, bind, and step a simple query.
    let mut stmt = conn.prepare_single("SELECT :greet || ' Turso'")?;
    stmt.bind_named("greet", Value::Text("Hello".into()))?;

    loop {
        match stmt.step()? {
            TursoStatusCode::Row => {
                // Read current row value. Valid until next step/reset/finalize.
                match stmt.row_value(0)? {
                    ValueRef::Text(t) => println!("{}", t.as_str()),
                    other => println!("row[0] = {:?}", other),
                }
            }
            TursoStatusCode::Io => {
                // Drive one iteration of the I/O backend.
                stmt.run_io()?;
            }
            TursoStatusCode::Done => break,
            _ => unreachable!("unexpected status"),
        }
    }

    // Finalize to complete the statement cleanly (may also return Io).
    match stmt.finalize()? {
        TursoStatusCode::Io => {
            // If needed, drive IO and finalize again.
            stmt.run_io()?;
            let _ = stmt.finalize()?;
        }
        _ => {}
    }

    Ok(())
}
```

## C example

```c
#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include "turso.h"

static void fail_and_cleanup(const char *msg, turso_status_t st) {
    fprintf(stderr, "%s: %s\n", msg, st.error ? st.error : "(no message)");
    if (st.error) turso_status_deinit(st);
}

int main(void) {
    // Optional: initialize logging (stdout example) and/or set log level via environment.
    // turso_setup((turso_config_t){ .logger = NULL, .log_level = "info" });

    // Create database holder (not opened yet). Enable caller-driven async I/O.
    turso_database_create_result_t db_res = turso_database_create(
        (turso_database_config_t){
            .path = ":memory:",
            .experimental_features = NULL,
            .async_io = true,
        }
    );
    if (db_res.status.code != TURSO_OK) {
        fail_and_cleanup("create database failed", db_res.status);
        return 1;
    }

    turso_status_t st = turso_database_open(db_res.database);
    if (st.code != TURSO_OK) {
        fail_and_cleanup("open failed", st);
        turso_database_deinit(db_res.database);
        return 1;
    }

    turso_database_connect_result_t conn_res = turso_database_connect(db_res.database);
    if (conn_res.status.code != TURSO_OK) {
        fail_and_cleanup("connect failed", conn_res.status);
        turso_database_deinit(db_res.database);
        return 1;
    }

    const char *sql = "SELECT :greet || ' Turso'";
    turso_connection_prepare_single_t prep =
        turso_connection_prepare_single(
            conn_res.connection,
            (turso_slice_ref_t){ .ptr = (const void*)sql, .len = strlen(sql) });

    if (prep.status.code != TURSO_OK) {
        fail_and_cleanup("prepare failed", prep.status);
        turso_connection_deinit(conn_res.connection);
        turso_database_deinit(db_res.database);
        return 1;
    }

    // Bind named parameter (omit the leading ':' in the name).
    const char *name = "greet";
    const char *val  = "Hello";
    st = turso_statement_bind_named(
        prep.statement,
        (turso_slice_ref_t){ .ptr = (const void*)name, .len = strlen(name) },
        turso_text(val, strlen(val))
    );
    if (st.code != TURSO_OK) {
        fail_and_cleanup("bind failed", st);
        turso_statement_deinit(prep.statement);
        turso_connection_deinit(conn_res.connection);
        turso_database_deinit(db_res.database);
        return 1;
    }

    // Drive the statement: handle ROW/IO/DONE.
    for (;;) {
        turso_status_t step = turso_statement_step(prep.statement);
        if (step.code == TURSO_IO) {
            // Run one iteration of the IO backend and continue.
            turso_status_t io = turso_statement_run_io(prep.statement);
            if (io.code != TURSO_OK) {
                fail_and_cleanup("run_io failed", io);
                break;
            }
            continue;
        }
        if (step.code == TURSO_ROW) {
            turso_statement_row_value_t rv = turso_statement_row_value(prep.statement, 0);
            if (rv.status.code == TURSO_OK && rv.value.type == TURSO_TYPE_TEXT) {
                const turso_slice_ref_t s = rv.value.value.text;
                fwrite(s.ptr, 1, s.len, stdout);
                fputc('\n', stdout);
            }
            continue;
        }
        if (step.code == TURSO_DONE) {
            break;
        }
        // Any other status is an error.
        fail_and_cleanup("step failed", step);
        break;
    }

    // Finalize; if it returns TURSO_IO, drive IO until OK.
    for (;;) {
        turso_status_t fin = turso_statement_finalize(prep.statement);
        if (fin.code == TURSO_OK) break;
        if (fin.code == TURSO_IO) {
            turso_status_t io = turso_statement_run_io(prep.statement);
            if (io.code != TURSO_OK) { fail_and_cleanup("finalize run_io failed", io); break; }
            continue;
        }
        fail_and_cleanup("finalize failed", fin);
        break;
    }

    // Clean up handles.
    turso_statement_deinit(prep.statement);
    turso_connection_deinit(conn_res.connection);
    turso_database_deinit(db_res.database);
    return 0;
}
```