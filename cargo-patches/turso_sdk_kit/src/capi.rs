#![allow(clippy::not_unsafe_ptr_arg_deref)]

use std::time::Duration;

use turso_core::{types::AsValueRef, types::Text, IOResult};
use turso_sdk_kit_macros::signature;

use crate::rsapi::{
    self, bytes_from_slice, c_string_to_str, str_from_c_str, str_from_slice, str_to_c_string,
    TursoConnection, TursoDatabase, TursoStatement,
};

pub mod c {
    #![allow(non_upper_case_globals)]
    #![allow(non_camel_case_types)]
    #![allow(non_snake_case)]
    #![allow(dead_code)]

    include!("bindings.rs");
}

pub static PKG_VERSION_C: &[u8] = concat!(env!("CARGO_PKG_VERSION"), "\0").as_bytes();

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_version() -> *const std::ffi::c_char {
    PKG_VERSION_C.as_ptr() as *const std::ffi::c_char
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_setup(
    config: *const c::turso_config_t,
    error_opt_out: *mut *const std::ffi::c_char,
) -> c::turso_status_code_t {
    let config = match unsafe { rsapi::TursoSetupConfig::from_capi(config) } {
        Ok(config) => config,
        Err(err) => return unsafe { err.to_capi(error_opt_out) },
    };
    match rsapi::turso_setup(config) {
        Ok(()) => c::turso_status_code_t::TURSO_OK,
        Err(err) => unsafe { err.to_capi(error_opt_out) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_database_new(
    config: *const c::turso_database_config_t,
    database: *mut *const c::turso_database_t,
    error_opt_out: *mut *const std::ffi::c_char,
) -> c::turso_status_code_t {
    let config = match unsafe { rsapi::TursoDatabaseConfig::from_capi(config) } {
        Ok(config) => config,
        Err(err) => return unsafe { err.to_capi(error_opt_out) },
    };
    unsafe { *database = rsapi::TursoDatabase::new(config).to_capi() };
    c::turso_status_code_t::TURSO_OK
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_database_open(
    database: *const c::turso_database_t,
    error_opt_out: *mut *const std::ffi::c_char,
) -> c::turso_status_code_t {
    let database = match unsafe { TursoDatabase::ref_from_capi(database) } {
        Ok(database) => database,
        Err(err) => return unsafe { err.to_capi(error_opt_out) },
    };
    match database.open() {
        Ok(IOResult::Done(..)) => c::turso_status_code_t::TURSO_OK,
        Ok(IOResult::IO(..)) => c::turso_status_code_t::TURSO_IO,
        Err(err) => unsafe { err.to_capi(error_opt_out) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_database_connect(
    database: *const c::turso_database_t,
    connection: *mut *mut c::turso_connection_t,
    error_opt_out: *mut *const std::ffi::c_char,
) -> c::turso_status_code_t {
    let database = match unsafe { TursoDatabase::ref_from_capi(database) } {
        Ok(database) => database,
        Err(err) => return unsafe { err.to_capi(error_opt_out) },
    };
    match database.connect() {
        Ok(conn) => {
            unsafe { *connection = conn.to_capi() };
            c::turso_status_code_t::TURSO_OK
        }
        Err(err) => unsafe { err.to_capi(error_opt_out) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_connection_set_busy_timeout_ms(
    connection: *const c::turso_connection_t,
    timeout_ms: i64,
) {
    if timeout_ms < 0 {
        return;
    }
    if let Ok(connection) = unsafe { TursoConnection::ref_from_capi(connection) } {
        connection.set_busy_timeout(Duration::from_millis(timeout_ms as u64));
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_connection_get_autocommit(
    connection: *const c::turso_connection_t,
) -> bool {
    match unsafe { TursoConnection::ref_from_capi(connection) } {
        Ok(connection) => connection.get_auto_commit(),
        Err(_) => false,
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_connection_last_insert_rowid(
    connection: *const c::turso_connection_t,
) -> i64 {
    match unsafe { TursoConnection::ref_from_capi(connection) } {
        Ok(connection) => connection.last_insert_rowid(),
        Err(_) => 0,
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_connection_prepare_single(
    connection: *const c::turso_connection_t,
    sql: *const std::ffi::c_char,
    statement: *mut *mut c::turso_statement_t,
    error_opt_out: *mut *const std::ffi::c_char,
) -> c::turso_status_code_t {
    let sql = match unsafe { str_from_c_str(sql) } {
        Ok(sql) => sql,
        Err(err) => return unsafe { err.to_capi(error_opt_out) },
    };
    let connection = match unsafe { TursoConnection::ref_from_capi(connection) } {
        Ok(connection) => connection,
        Err(err) => return unsafe { err.to_capi(error_opt_out) },
    };

    match connection.prepare_single(sql) {
        Ok(stmt) => {
            unsafe { *statement = stmt.to_capi() };
            c::turso_status_code_t::TURSO_OK
        }
        Err(err) => unsafe { err.to_capi(error_opt_out) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_connection_prepare_first(
    connection: *const c::turso_connection_t,
    sql: *const std::ffi::c_char,
    statement: *mut *mut c::turso_statement_t,
    tail_idx: *mut usize,
    error_opt_out: *mut *const std::ffi::c_char,
) -> c::turso_status_code_t {
    let sql = match unsafe { str_from_c_str(sql) } {
        Ok(sql) => sql,
        Err(err) => return unsafe { err.to_capi(error_opt_out) },
    };
    let connection = match unsafe { TursoConnection::ref_from_capi(connection) } {
        Ok(connection) => connection,
        Err(err) => return unsafe { err.to_capi(error_opt_out) },
    };
    match connection.prepare_first(sql) {
        Ok(Some((stmt, tail))) => {
            unsafe {
                *statement = stmt.to_capi();
                *tail_idx = tail;
            };
            c::turso_status_code_t::TURSO_OK
        }
        Ok(None) => {
            unsafe {
                *statement = std::ptr::null_mut();
            }
            c::turso_status_code_t::TURSO_OK
        }
        Err(err) => unsafe { err.to_capi(error_opt_out) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_connection_close(
    connection: *const c::turso_connection_t,
    error_opt_out: *mut *const std::ffi::c_char,
) -> c::turso_status_code_t {
    let connection = match unsafe { TursoConnection::ref_from_capi(connection) } {
        Ok(connection) => connection,
        Err(err) => return unsafe { err.to_capi(error_opt_out) },
    };
    match connection.close() {
        Ok(()) => c::turso_status_code_t::TURSO_OK,
        Err(err) => unsafe { err.to_capi(error_opt_out) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_run_io(
    statement: *const c::turso_statement_t,
    error_opt_out: *mut *const std::ffi::c_char,
) -> c::turso_status_code_t {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(err) => return unsafe { err.to_capi(error_opt_out) },
    };
    match statement.run_io() {
        Ok(()) => c::turso_status_code_t::TURSO_OK,
        Err(err) => unsafe { err.to_capi(error_opt_out) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_execute(
    statement: *const c::turso_statement_t,
    rows_changed: *mut u64,
    error_opt_out: *mut *const std::ffi::c_char,
) -> c::turso_status_code_t {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(err) => return unsafe { err.to_capi(error_opt_out) },
    };
    match statement.execute(None) {
        Ok(result) => {
            if !rows_changed.is_null() {
                unsafe { *rows_changed = result.rows_changed };
            }
            result.status.to_capi()
        }
        Err(err) => unsafe { err.to_capi(error_opt_out) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_step(
    statement: *const c::turso_statement_t,
    error_opt_out: *mut *const std::ffi::c_char,
) -> c::turso_status_code_t {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(err) => return unsafe { err.to_capi(error_opt_out) },
    };
    match statement.step(None) {
        Ok(status) => status.to_capi(),
        Err(err) => unsafe { err.to_capi(error_opt_out) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_reset(
    statement: *const c::turso_statement_t,
    error_opt_out: *mut *const std::ffi::c_char,
) -> c::turso_status_code_t {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(err) => return unsafe { err.to_capi(error_opt_out) },
    };
    match statement.reset() {
        Ok(()) => c::turso_status_code_t::TURSO_OK,
        Err(err) => unsafe { err.to_capi(error_opt_out) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_finalize(
    statement: *const c::turso_statement_t,
    error_opt_out: *mut *const std::ffi::c_char,
) -> c::turso_status_code_t {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(err) => return unsafe { err.to_capi(error_opt_out) },
    };
    match statement.finalize(None) {
        Ok(status) => status.to_capi(),
        Err(err) => unsafe { err.to_capi(error_opt_out) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_n_change(statement: *const c::turso_statement_t) -> i64 {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(_) => return 0,
    };
    statement.n_change()
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_column_name(
    statement: *const c::turso_statement_t,
    index: usize,
) -> *const std::ffi::c_char {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(_) => return std::ptr::null(),
    };
    let column = match statement.column_name(index) {
        Ok(column) => column.to_string(),
        Err(_) => return std::ptr::null(),
    };
    str_to_c_string(&column)
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_column_count(statement: *const c::turso_statement_t) -> i64 {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(_) => return -1,
    };
    statement.column_count() as i64
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_column_decltype(
    statement: *const c::turso_statement_t,
    index: usize,
) -> *const std::ffi::c_char {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(_) => return std::ptr::null(),
    };
    match statement.column_decltype(index) {
        Some(decltype) => str_to_c_string(&decltype),
        None => std::ptr::null(),
    }
}

/// Lock the statement handle and get a ValueRef for the given row index.
/// Returns None if the statement is null, finalized, has no row, or index is out of bounds.
/// The returned MutexGuard must be kept alive for the duration of ValueRef use.
macro_rules! with_row_value {
    ($statement:expr, $index:expr, $default:expr, $body:expr) => {{
        let statement = match unsafe { TursoStatement::ref_from_capi($statement) } {
            Ok(s) => s,
            Err(_) => return $default,
        };
        let handle = statement.handle.lock().unwrap();
        let Some(stmt) = handle.as_ref() else {
            return $default;
        };
        let Some(row) = stmt.row() else {
            return $default;
        };
        if $index >= row.len() {
            return $default;
        }
        let value_ref = row.get_value($index).as_value_ref();
        #[allow(clippy::redundant_closure_call)]
        ($body)(value_ref)
    }};
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_row_value_kind(
    statement: *const c::turso_statement_t,
    index: usize,
) -> c::turso_type_t {
    with_row_value!(
        statement,
        index,
        c::turso_type_t::TURSO_TYPE_UNKNOWN,
        |value_ref: turso_core::ValueRef| {
            match value_ref {
                turso_core::ValueRef::Null => c::turso_type_t::TURSO_TYPE_NULL,
                turso_core::ValueRef::Numeric(turso_core::Numeric::Integer(..)) => {
                    c::turso_type_t::TURSO_TYPE_INTEGER
                }
                turso_core::ValueRef::Numeric(turso_core::Numeric::Float(..)) => {
                    c::turso_type_t::TURSO_TYPE_REAL
                }
                turso_core::ValueRef::Text(..) => c::turso_type_t::TURSO_TYPE_TEXT,
                turso_core::ValueRef::Blob(..) => c::turso_type_t::TURSO_TYPE_BLOB,
            }
        }
    )
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_row_value_bytes_count(
    statement: *const c::turso_statement_t,
    index: usize,
) -> i64 {
    with_row_value!(statement, index, -1, |value_ref: turso_core::ValueRef| {
        match value_ref {
            turso_core::ValueRef::Text(text) => text.len() as i64,
            turso_core::ValueRef::Blob(blob) => blob.len() as i64,
            _ => -1,
        }
    })
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_row_value_bytes_ptr(
    statement: *const c::turso_statement_t,
    index: usize,
) -> *const std::ffi::c_char {
    with_row_value!(
        statement,
        index,
        std::ptr::null(),
        |value_ref: turso_core::ValueRef| {
            match value_ref {
                turso_core::ValueRef::Text(text) => {
                    text.as_bytes().as_ptr() as *const std::ffi::c_char
                }
                turso_core::ValueRef::Blob(blob) => blob.as_ptr() as *const std::ffi::c_char,
                _ => std::ptr::null(),
            }
        }
    )
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_row_value_int(
    statement: *const c::turso_statement_t,
    index: usize,
) -> i64 {
    with_row_value!(statement, index, 0, |value_ref: turso_core::ValueRef| {
        match value_ref {
            turso_core::ValueRef::Numeric(turso_core::Numeric::Integer(value)) => value,
            _ => 0,
        }
    })
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_row_value_double(
    statement: *const c::turso_statement_t,
    index: usize,
) -> f64 {
    with_row_value!(statement, index, 0.0, |value_ref: turso_core::ValueRef| {
        match value_ref {
            turso_core::ValueRef::Numeric(turso_core::Numeric::Float(value)) => f64::from(value),
            _ => 0.0,
        }
    })
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_named_position(
    statement: *const c::turso_statement_t,
    name: *const std::ffi::c_char,
) -> i64 {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(_) => return -1,
    };
    let name = match unsafe { str_from_c_str(name) } {
        Ok(name) => name,
        Err(_) => return -1,
    };
    match statement.named_position(name) {
        Ok(position) => position as i64,
        Err(_) => -1,
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_parameters_count(statement: *const c::turso_statement_t) -> i64 {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(_) => return -1,
    };
    statement.parameters_count() as i64
}

/// Return the name of the parameter at 1-based `index`, including the SQL
/// prefix (e.g. `:name`, `@name`, `$name`). Returns NULL for positional-only
/// parameters or out-of-range indices. The caller must free the returned
/// string with `turso_str_deinit`.
#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_parameter_name(
    statement: *const c::turso_statement_t,
    index: i64,
) -> *const std::ffi::c_char {
    if index <= 0 {
        return std::ptr::null();
    }
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(_) => return std::ptr::null(),
    };
    match statement.parameter_name(index as usize) {
        Some(name) => str_to_c_string(&name),
        None => std::ptr::null(),
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_bind_positional_null(
    statement: *const c::turso_statement_t,
    position: usize,
) -> c::turso_status_code_t {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(err) => return unsafe { err.to_capi(std::ptr::null_mut()) },
    };
    match statement.bind_positional(position, turso_core::Value::Null) {
        Ok(()) => c::turso_status_code_t::TURSO_OK,
        Err(err) => unsafe { err.to_capi(std::ptr::null_mut()) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_bind_positional_int(
    statement: *const c::turso_statement_t,
    position: usize,
    value: i64,
) -> c::turso_status_code_t {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(err) => return unsafe { err.to_capi(std::ptr::null_mut()) },
    };
    match statement.bind_positional(position, turso_core::Value::from_i64(value)) {
        Ok(()) => c::turso_status_code_t::TURSO_OK,
        Err(err) => unsafe { err.to_capi(std::ptr::null_mut()) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_bind_positional_double(
    statement: *const c::turso_statement_t,
    position: usize,
    value: f64,
) -> c::turso_status_code_t {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(err) => return unsafe { err.to_capi(std::ptr::null_mut()) },
    };
    match statement.bind_positional(position, turso_core::Value::from_f64(value)) {
        Ok(()) => c::turso_status_code_t::TURSO_OK,
        Err(err) => unsafe { err.to_capi(std::ptr::null_mut()) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_bind_positional_text(
    statement: *const c::turso_statement_t,
    position: usize,
    ptr: *const std::ffi::c_char,
    len: usize,
) -> c::turso_status_code_t {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(err) => return unsafe { err.to_capi(std::ptr::null_mut()) },
    };
    let text = match unsafe { str_from_slice(ptr, len) } {
        Ok(text) => text,
        Err(err) => return unsafe { err.to_capi(std::ptr::null_mut()) },
    };
    // we can't guarantee lifetime for the provided text - so we explicitly copy it to the owned string
    match statement.bind_positional(
        position,
        turso_core::Value::Text(Text::new(text.to_string())),
    ) {
        Ok(()) => c::turso_status_code_t::TURSO_OK,
        Err(err) => unsafe { err.to_capi(std::ptr::null_mut()) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_bind_positional_blob(
    statement: *const c::turso_statement_t,
    position: usize,
    ptr: *const std::ffi::c_char,
    len: usize,
) -> c::turso_status_code_t {
    let statement = match unsafe { TursoStatement::ref_from_capi(statement) } {
        Ok(statement) => statement,
        Err(err) => return unsafe { err.to_capi(std::ptr::null_mut()) },
    };
    let bytes = match unsafe { bytes_from_slice(ptr, len) } {
        Ok(bytes) => bytes,
        Err(err) => return unsafe { err.to_capi(std::ptr::null_mut()) },
    };
    match statement.bind_positional(position, turso_core::Value::Blob(bytes.to_vec())) {
        Ok(()) => c::turso_status_code_t::TURSO_OK,
        Err(err) => unsafe { err.to_capi(std::ptr::null_mut()) },
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_str_deinit(s: *const std::ffi::c_char) {
    if !s.is_null() {
        drop(c_string_to_str(s));
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_database_deinit(database: *const c::turso_database_t) {
    if !database.is_null() {
        drop(unsafe { TursoDatabase::arc_from_capi(database) })
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_connection_deinit(connection: *const c::turso_connection_t) {
    if !connection.is_null() {
        drop(unsafe { TursoConnection::arc_from_capi(connection) })
    }
}

#[no_mangle]
#[signature(c)]
pub extern "C" fn turso_statement_deinit(statement: *const c::turso_statement_t) {
    if !statement.is_null() {
        drop(unsafe { TursoStatement::box_from_capi(statement) })
    }
}

// used in tests for sdk-kit (db and sync)
pub fn value_from_c_value(stmt: *mut c::turso_statement_t, index: usize) -> turso_core::Value {
    unsafe {
        match turso_statement_row_value_kind(stmt, index) {
            c::turso_type_t::TURSO_TYPE_UNKNOWN => panic!("unknown value kind"),
            c::turso_type_t::TURSO_TYPE_NULL => turso_core::Value::Null,
            c::turso_type_t::TURSO_TYPE_INTEGER => {
                turso_core::Value::from_i64(turso_statement_row_value_int(stmt, index))
            }
            c::turso_type_t::TURSO_TYPE_REAL => {
                turso_core::Value::from_f64(turso_statement_row_value_double(stmt, index))
            }
            c::turso_type_t::TURSO_TYPE_TEXT => {
                let ptr = turso_statement_row_value_bytes_ptr(stmt, index);
                let len = turso_statement_row_value_bytes_count(stmt, index);
                assert!(len >= 0);
                let str = str_from_slice(ptr, len as usize).unwrap();
                turso_core::Value::Text(Text::new(str.to_string()))
            }
            c::turso_type_t::TURSO_TYPE_BLOB => {
                let ptr = turso_statement_row_value_bytes_ptr(stmt, index);
                let len = turso_statement_row_value_bytes_count(stmt, index);
                assert!(len >= 0);
                let slice = bytes_from_slice(ptr, len as usize).unwrap();
                turso_core::Value::Blob(slice.to_vec())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::ffi::{CStr, CString};

    use turso_core::types::Text;

    use crate::capi::{
        c::{
            self, turso_connection_deinit, turso_connection_prepare_single, turso_database_connect,
            turso_database_deinit, turso_database_new, turso_database_open, turso_setup,
            turso_statement_bind_positional_blob, turso_statement_bind_positional_double,
            turso_statement_bind_positional_int, turso_statement_bind_positional_null,
            turso_statement_bind_positional_text, turso_statement_column_count,
            turso_statement_deinit, turso_statement_execute, turso_statement_n_change,
            turso_statement_named_position, turso_statement_parameters_count,
            turso_statement_run_io, turso_statement_step, turso_status_code_t, turso_str_deinit,
            turso_version,
        },
        value_from_c_value,
    };

    extern "C" fn logger(log: *const c::turso_log_t) {
        println!("log: {:?}", unsafe {
            std::ffi::CStr::from_ptr((*log).message)
        });
    }

    #[test]
    pub fn test_version() {
        unsafe {
            let version = CStr::from_ptr(turso_version()).to_str().unwrap();
            println!("{version}");
            assert_eq!(version, env!("CARGO_PKG_VERSION"));
        }
    }

    #[test]
    pub fn test_db_setup() {
        unsafe {
            let config = c::turso_config_t {
                logger: Some(logger),
                log_level: c"debug".as_ptr(),
            };
            turso_setup(&config, std::ptr::null_mut());
        }
    }

    #[test]
    pub fn test_db_init() {
        unsafe {
            let path = CString::new(":memory:").unwrap();
            let config = c::turso_database_config_t {
                path: path.as_ptr(),
                ..Default::default()
            };
            let mut db = std::ptr::null();
            let status = turso_database_new(&config, &mut db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let status = turso_database_open(db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            turso_database_deinit(db);
        }
    }

    #[test]
    pub fn test_db_error() {
        unsafe {
            let path = CString::new("not/existing/path").unwrap();
            let config = c::turso_database_config_t {
                path: path.as_ptr(),
                ..Default::default()
            };
            let mut db = std::ptr::null();
            let status = turso_database_new(&config, &mut db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let mut error = std::ptr::null();
            let status = turso_database_open(db, &mut error);

            assert_eq!(status, turso_status_code_t::TURSO_IOERR);
            assert_eq!(
                std::ffi::CStr::from_ptr(error).to_str().unwrap(),
                "I/O error (open): entity not found"
            );
            turso_str_deinit(error);
            turso_database_deinit(db);
        }
    }

    #[test]
    pub fn test_db_conn_init() {
        unsafe {
            let path = CString::new(":memory:").unwrap();
            let config = c::turso_database_config_t {
                path: path.as_ptr(),
                ..Default::default()
            };
            let mut db = std::ptr::null();
            let status = turso_database_new(&config, &mut db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let status = turso_database_open(db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let mut connection = std::ptr::null_mut();
            let status = turso_database_connect(db, &mut connection, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            turso_connection_deinit(connection);
            turso_database_deinit(db);
        }
    }

    #[test]
    pub fn test_db_stmt_prepare() {
        unsafe {
            let path = CString::new(":memory:").unwrap();
            let config = c::turso_database_config_t {
                path: path.as_ptr(),
                ..Default::default()
            };
            let mut db = std::ptr::null();
            let status = turso_database_new(&config, &mut db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let status = turso_database_open(db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let mut connection = std::ptr::null_mut();
            let status = turso_database_connect(db, &mut connection, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let sql = c"SELECT NULL, 2, 2.71, '5', x'06'";
            let mut statement = std::ptr::null_mut();
            let status = turso_connection_prepare_single(
                connection,
                sql.as_ptr(),
                &mut statement,
                std::ptr::null_mut(),
            );
            assert_eq!(status, turso_status_code_t::TURSO_OK);
            assert_eq!(turso_statement_n_change(statement), 0);

            turso_statement_deinit(statement);
            turso_connection_deinit(connection);
            turso_database_deinit(db);
        }
    }

    #[test]
    pub fn test_db_stmt_prepare_parse_error() {
        unsafe {
            let path = CString::new(":memory:").unwrap();
            let config = c::turso_database_config_t {
                path: path.as_ptr(),
                ..Default::default()
            };
            let mut db = std::ptr::null();
            let status = turso_database_new(&config, &mut db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let status = turso_database_open(db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let mut connection = std::ptr::null_mut();
            let status = turso_database_connect(db, &mut connection, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let mut error = std::ptr::null();
            let sql = c"SELECT nil";
            let mut statement = std::ptr::null_mut();
            let status = turso_connection_prepare_single(
                connection,
                sql.as_ptr(),
                &mut statement,
                &mut error,
            );
            assert_eq!(status, turso_status_code_t::TURSO_ERROR);
            assert_eq!(
                std::ffi::CStr::from_ptr(error).to_str().unwrap(),
                "Parse error: no such column: nil"
            );

            turso_str_deinit(error);
            turso_connection_deinit(connection);
            turso_database_deinit(db);
        }
    }

    #[test]
    pub fn test_db_stmt_execute() {
        unsafe {
            let path = CString::new(":memory:").unwrap();
            let config = c::turso_database_config_t {
                path: path.as_ptr(),
                ..Default::default()
            };
            let mut db = std::ptr::null();
            let status = turso_database_new(&config, &mut db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let status = turso_database_open(db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let mut connection = std::ptr::null_mut();
            let status = turso_database_connect(db, &mut connection, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let sql = c"CREATE TABLE t(x)";
            let mut statement = std::ptr::null_mut();
            let status = turso_connection_prepare_single(
                connection,
                sql.as_ptr(),
                &mut statement,
                std::ptr::null_mut(),
            );
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            loop {
                let status =
                    turso_statement_execute(statement, std::ptr::null_mut(), std::ptr::null_mut());
                if status == turso_status_code_t::TURSO_DONE {
                    break;
                }
                let status = turso_statement_run_io(statement, std::ptr::null_mut());
                assert_eq!(status, turso_status_code_t::TURSO_DONE);
            }
            turso_statement_deinit(statement);

            let mut error = std::ptr::null();
            let status = turso_connection_prepare_single(
                connection,
                sql.as_ptr(),
                &mut statement,
                &mut error,
            );
            assert_eq!(status, turso_status_code_t::TURSO_ERROR);
            assert_eq!(
                std::ffi::CStr::from_ptr(error).to_str().unwrap(),
                "Parse error: table t already exists"
            );

            turso_str_deinit(error);

            turso_connection_deinit(connection);
            turso_database_deinit(db);
        }
    }

    #[test]
    pub fn test_db_stmt_insert() {
        unsafe {
            let path = CString::new(":memory:").unwrap();
            let config = c::turso_database_config_t {
                path: path.as_ptr(),
                ..Default::default()
            };
            let mut db = std::ptr::null();
            let status = turso_database_new(&config, &mut db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let status = turso_database_open(db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let mut connection = std::ptr::null_mut();
            let status = turso_database_connect(db, &mut connection, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let ddl = c"CREATE TABLE t(x)";
            let mut statement = std::ptr::null_mut();
            let status = turso_connection_prepare_single(
                connection,
                ddl.as_ptr(),
                &mut statement,
                std::ptr::null_mut(),
            );
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            loop {
                let status =
                    turso_statement_execute(statement, std::ptr::null_mut(), std::ptr::null_mut());
                if status == turso_status_code_t::TURSO_DONE {
                    break;
                }
                let status = turso_statement_run_io(statement, std::ptr::null_mut());
                assert_eq!(status, turso_status_code_t::TURSO_DONE);
            }
            turso_statement_deinit(statement);

            let dml = c"INSERT INTO t VALUES (1), (2), (3)";
            let mut statement = std::ptr::null_mut();
            let status = turso_connection_prepare_single(
                connection,
                dml.as_ptr(),
                &mut statement,
                std::ptr::null_mut(),
            );
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            loop {
                let status =
                    turso_statement_execute(statement, std::ptr::null_mut(), std::ptr::null_mut());
                if status == turso_status_code_t::TURSO_DONE {
                    break;
                }
                let status = turso_statement_run_io(statement, std::ptr::null_mut());
                assert_eq!(status, turso_status_code_t::TURSO_DONE);
            }
            assert_eq!(turso_statement_n_change(statement), 3);
            turso_statement_deinit(statement);

            turso_connection_deinit(connection);
            turso_database_deinit(db);
        }
    }

    #[test]
    pub fn test_db_stmt_query() {
        unsafe {
            let path = CString::new(":memory:").unwrap();
            let config = c::turso_database_config_t {
                path: path.as_ptr(),
                ..Default::default()
            };
            let mut db = std::ptr::null();
            let status = turso_database_new(&config, &mut db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let status = turso_database_open(db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let mut connection = std::ptr::null_mut();
            let status = turso_database_connect(db, &mut connection, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let sql = c"SELECT NULL, 2, 2.71, '5', x'06'";
            let mut statement = std::ptr::null_mut();
            let status = turso_connection_prepare_single(
                connection,
                sql.as_ptr(),
                &mut statement,
                std::ptr::null_mut(),
            );
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let columns = turso_statement_column_count(statement);
            assert_eq!(columns, 5);
            let mut collected = Vec::new();
            loop {
                let status = turso_statement_step(statement, std::ptr::null_mut());
                if status == turso_status_code_t::TURSO_IO {
                    let status = turso_statement_run_io(statement, std::ptr::null_mut());
                    assert_eq!(status, turso_status_code_t::TURSO_OK);
                    continue;
                }
                if status == turso_status_code_t::TURSO_DONE {
                    break;
                }
                if status == turso_status_code_t::TURSO_ROW {
                    for i in 0..columns {
                        collected.push(value_from_c_value(statement, i as usize));
                    }
                    continue;
                }
                panic!("unexpected");
            }

            turso_statement_deinit(statement);
            turso_connection_deinit(connection);
            turso_database_deinit(db);
            assert_eq!(
                collected,
                vec![
                    turso_core::Value::Null,
                    turso_core::Value::from_i64(2),
                    turso_core::Value::from_f64(2.71),
                    turso_core::Value::Text(Text::new("5")),
                    turso_core::Value::Blob(vec![6]),
                ]
            );
        }
    }

    #[test]
    pub fn test_db_stmt_bind_positional() {
        unsafe {
            let path = CString::new(":memory:").unwrap();
            let config = c::turso_database_config_t {
                path: path.as_ptr(),
                ..Default::default()
            };
            let mut db = std::ptr::null();
            let status = turso_database_new(&config, &mut db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let status = turso_database_open(db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let mut connection = std::ptr::null_mut();
            let status = turso_database_connect(db, &mut connection, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let sql = c"SELECT ?, ?, ?, ?, ?";
            let mut statement = std::ptr::null_mut();
            let status = turso_connection_prepare_single(
                connection,
                sql.as_ptr(),
                &mut statement,
                std::ptr::null_mut(),
            );
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            assert_eq!(
                turso_statement_bind_positional_null(statement, 1),
                turso_status_code_t::TURSO_OK
            );
            assert_eq!(
                turso_statement_bind_positional_int(statement, 2, 2),
                turso_status_code_t::TURSO_OK
            );
            assert_eq!(
                turso_statement_bind_positional_double(statement, 3, 2.71),
                turso_status_code_t::TURSO_OK
            );
            let text = "5";
            assert_eq!(
                turso_statement_bind_positional_text(
                    statement,
                    4,
                    text.as_ptr() as *const std::ffi::c_char,
                    text.len()
                ),
                turso_status_code_t::TURSO_OK
            );
            let blob = [6];
            assert_eq!(
                turso_statement_bind_positional_blob(statement, 5, blob.as_ptr(), blob.len()),
                turso_status_code_t::TURSO_OK
            );

            let columns = turso_statement_column_count(statement);
            assert_eq!(columns, 5);
            let mut collected = Vec::new();
            loop {
                let status = turso_statement_step(statement, std::ptr::null_mut());
                if status == turso_status_code_t::TURSO_IO {
                    let status = turso_statement_run_io(statement, std::ptr::null_mut());
                    assert_eq!(status, turso_status_code_t::TURSO_OK);
                    continue;
                }
                if status == turso_status_code_t::TURSO_DONE {
                    break;
                }
                if status == turso_status_code_t::TURSO_ROW {
                    for i in 0..columns {
                        collected.push(value_from_c_value(statement, i as usize));
                    }
                    continue;
                }
                panic!("unexpected");
            }

            turso_statement_deinit(statement);
            turso_connection_deinit(connection);
            turso_database_deinit(db);

            assert_eq!(
                collected,
                vec![
                    turso_core::Value::Null,
                    turso_core::Value::from_i64(2),
                    turso_core::Value::from_f64(2.71),
                    turso_core::Value::Text(Text::new("5")),
                    turso_core::Value::Blob(vec![6]),
                ]
            );
        }
    }

    #[test]
    pub fn test_db_stmt_bind_named() {
        unsafe {
            let path = CString::new(":memory:").unwrap();
            let config = c::turso_database_config_t {
                path: path.as_ptr(),
                ..Default::default()
            };
            let mut db = std::ptr::null();
            let status = turso_database_new(&config, &mut db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let status = turso_database_open(db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let mut connection = std::ptr::null_mut();
            let status = turso_database_connect(db, &mut connection, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let sql = c"SELECT :e, :d, :c, :b, :a";
            let mut statement = std::ptr::null_mut();
            let status = turso_connection_prepare_single(
                connection,
                sql.as_ptr(),
                &mut statement,
                std::ptr::null_mut(),
            );
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            assert_eq!(
                turso_statement_bind_positional_null(
                    statement,
                    turso_statement_named_position(statement, c":e".as_ptr()) as usize
                ),
                turso_status_code_t::TURSO_OK
            );
            assert_eq!(
                turso_statement_bind_positional_int(
                    statement,
                    turso_statement_named_position(statement, c":d".as_ptr()) as usize,
                    2
                ),
                turso_status_code_t::TURSO_OK
            );
            assert_eq!(
                turso_statement_bind_positional_double(
                    statement,
                    turso_statement_named_position(statement, c":c".as_ptr()) as usize,
                    2.71
                ),
                turso_status_code_t::TURSO_OK
            );
            let text = "5";
            assert_eq!(
                turso_statement_bind_positional_text(
                    statement,
                    turso_statement_named_position(statement, c":b".as_ptr()) as usize,
                    text.as_ptr() as *const std::ffi::c_char,
                    text.len()
                ),
                turso_status_code_t::TURSO_OK
            );
            let blob = [6];
            assert_eq!(
                turso_statement_bind_positional_blob(
                    statement,
                    turso_statement_named_position(statement, c":a".as_ptr()) as usize,
                    blob.as_ptr(),
                    blob.len()
                ),
                turso_status_code_t::TURSO_OK
            );

            let columns = turso_statement_column_count(statement);
            assert_eq!(columns, 5);
            let mut collected = Vec::new();
            loop {
                let status = turso_statement_step(statement, std::ptr::null_mut());
                if status == turso_status_code_t::TURSO_IO {
                    let status = turso_statement_run_io(statement, std::ptr::null_mut());
                    assert_eq!(status, turso_status_code_t::TURSO_OK);
                    continue;
                }
                if status == turso_status_code_t::TURSO_DONE {
                    break;
                }
                if status == turso_status_code_t::TURSO_ROW {
                    for i in 0..columns {
                        collected.push(value_from_c_value(statement, i as usize));
                    }
                    continue;
                }
                panic!("unexpected");
            }

            turso_statement_deinit(statement);
            turso_connection_deinit(connection);
            turso_database_deinit(db);

            assert_eq!(
                collected,
                vec![
                    turso_core::Value::Null,
                    turso_core::Value::from_i64(2),
                    turso_core::Value::from_f64(2.71),
                    turso_core::Value::Text(Text::new("5")),
                    turso_core::Value::Blob(vec![6]),
                ]
            );
        }
    }

    #[test]
    pub fn test_db_stmt_named_position_requires_prefixed_name() {
        unsafe {
            let path = CString::new(":memory:").unwrap();
            let config = c::turso_database_config_t {
                path: path.as_ptr(),
                ..Default::default()
            };
            let mut db = std::ptr::null();
            let status = turso_database_new(&config, &mut db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let status = turso_database_open(db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let mut connection = std::ptr::null_mut();
            let status = turso_database_connect(db, &mut connection, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let sql = c"SELECT :e";
            let mut statement = std::ptr::null_mut();
            let status = turso_connection_prepare_single(
                connection,
                sql.as_ptr(),
                &mut statement,
                std::ptr::null_mut(),
            );
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            assert_eq!(turso_statement_named_position(statement, c":e".as_ptr()), 1);
            assert_eq!(turso_statement_named_position(statement, c"e".as_ptr()), -1);

            turso_statement_deinit(statement);
            turso_connection_deinit(connection);
            turso_database_deinit(db);
        }
    }

    #[test]
    pub fn test_db_stmt_bind_positional_out_of_bounds() {
        unsafe {
            let path = CString::new(":memory:").unwrap();
            let config = c::turso_database_config_t {
                path: path.as_ptr(),
                ..Default::default()
            };
            let mut db = std::ptr::null();
            let status = turso_database_new(&config, &mut db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let status = turso_database_open(db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let mut connection = std::ptr::null_mut();
            let status = turso_database_connect(db, &mut connection, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let sql = c"SELECT ?1";
            let mut statement = std::ptr::null_mut();
            let status = turso_connection_prepare_single(
                connection,
                sql.as_ptr(),
                &mut statement,
                std::ptr::null_mut(),
            );
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            assert_eq!(
                turso_statement_bind_positional_int(statement, 1, 1),
                turso_status_code_t::TURSO_OK
            );
            assert_eq!(
                turso_statement_bind_positional_int(statement, 2, 2),
                turso_status_code_t::TURSO_MISUSE
            );

            turso_statement_deinit(statement);
            turso_connection_deinit(connection);
            turso_database_deinit(db);
        }
    }

    #[test]
    pub fn test_db_stmt_sparse_positional_slot_range_matches_sqlite() {
        unsafe {
            let path = CString::new(":memory:").unwrap();
            let config = c::turso_database_config_t {
                path: path.as_ptr(),
                ..Default::default()
            };
            let mut db = std::ptr::null();
            let status = turso_database_new(&config, &mut db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let status = turso_database_open(db, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let mut connection = std::ptr::null_mut();
            let status = turso_database_connect(db, &mut connection, std::ptr::null_mut());
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            let sql = c"SELECT ?3";
            let mut statement = std::ptr::null_mut();
            let status = turso_connection_prepare_single(
                connection,
                sql.as_ptr(),
                &mut statement,
                std::ptr::null_mut(),
            );
            assert_eq!(status, turso_status_code_t::TURSO_OK);

            assert_eq!(turso_statement_parameters_count(statement), 3);
            assert_eq!(
                turso_statement_bind_positional_int(statement, 1, 1),
                turso_status_code_t::TURSO_OK
            );
            assert_eq!(
                turso_statement_bind_positional_int(statement, 3, 3),
                turso_status_code_t::TURSO_OK
            );
            assert_eq!(
                turso_statement_bind_positional_int(statement, 4, 4),
                turso_status_code_t::TURSO_MISUSE
            );

            turso_statement_deinit(statement);
            turso_connection_deinit(connection);
            turso_database_deinit(db);
        }
    }
}
