use std::fs::{create_dir_all, remove_file};
use std::path::PathBuf;

use napi::bindgen_prelude::External;
use rusqlite::Connection;

use crate::native::machine_id::get_machine_id;

#[napi]
pub fn connect_to_nx_db(
    cache_dir: String,
    nx_version: String,
) -> anyhow::Result<External<Connection>> {
    let machine_id = get_machine_id();
    let cache_dir_buf = PathBuf::from(cache_dir);
    let db_path = cache_dir_buf.join(format!("{}.db", machine_id));
    create_dir_all(cache_dir_buf)?;

    let c = create_connection(&db_path)?;

    let db_version = c.query_row(
        "SELECT value FROM metadata WHERE key='NX_VERSION'",
        [],
        |row| {
            let r: String = row.get(0)?;
            Ok(r)
        },
    );

    let c = match db_version {
        Ok(version) if version == nx_version => c,
        _ => {
            c.close().map_err(|(_, error)| anyhow::Error::from(error))?;
            remove_file(&db_path)?;

            create_connection(&db_path)?
        }
    };

    c.execute(
        "CREATE TABLE IF NOT EXISTS metadata (
            key TEXT NOT NULL PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    c.execute(
        "INSERT OR REPLACE INTO metadata (key, value) VALUES ('NX_VERSION', ?)",
        [nx_version],
    )?;

    Ok(External::new(c))
}

fn create_connection(db_path: &PathBuf) -> anyhow::Result<Connection> {
    let c = Connection::open(db_path).map_err(anyhow::Error::from)?;

    // This allows writes at the same time as reads
    c.pragma_update(None, "journal_mode", "WAL")?;

    // This makes things less synchronous than default
    c.pragma_update(None, "synchronous", "NORMAL")?;

    Ok(c)
}
