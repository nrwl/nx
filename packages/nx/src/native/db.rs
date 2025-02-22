use napi::bindgen_prelude::External;
use std::fs::create_dir_all;
use std::path::PathBuf;

use nx_db::connection::NxDbConnection;
use nx_logger::enable_logger;
use nx_utils::machine_id::get_machine_id;

#[napi]
pub fn connect_to_nx_db(
    cache_dir: String,
    nx_version: String,
    db_name: Option<String>,
) -> anyhow::Result<External<NxDbConnection>> {
    enable_logger();
    let cache_dir_buf = PathBuf::from(&cache_dir);
    create_dir_all(&cache_dir_buf)?;

    let machine_id = get_machine_id();
    let connection = nx_db::connect_to_nx_db(cache_dir, nx_version, db_name, machine_id)?;
    Ok(External::new(connection))
}

#[napi]
pub fn close_db_connection(mut connection: External<NxDbConnection>) -> anyhow::Result<()> {
    nx_db::close_db_connection(std::mem::take(connection.as_mut()))
}
