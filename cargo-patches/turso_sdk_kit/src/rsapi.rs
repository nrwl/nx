use std::{
    collections::HashMap,
    fmt::Display,
    ops::Deref,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex, Once, RwLock, Weak,
    },
    task::Waker,
    time::Duration,
};

use tracing::level_filters::LevelFilter;
use tracing_subscriber::{
    fmt::{self, format::Writer},
    layer::{Context, SubscriberExt},
    util::SubscriberInitExt,
    EnvFilter, Layer,
};
use turso_core::{
    storage::database::DatabaseFile, types::AsValueRef, Connection, Database, DatabaseOpts,
    DatabaseStorage, EncryptionKey, IOResult, LimboError, OpenDbAsyncState, OpenFlags, QueryMode,
    Statement, StepResult, IO,
};

use crate::{
    assert_send, assert_sync,
    capi::{self, c},
    ConcurrentGuard,
};

assert_send!(TursoDatabase, TursoConnection, TursoStatement);
assert_sync!(TursoDatabase);

pub use turso_core::types::FromValue;
pub type EncryptionOpts = turso_core::EncryptionOpts;
pub type Value = turso_core::Value;
pub type ValueRef<'a> = turso_core::types::ValueRef<'a>;
pub type Text = turso_core::types::Text;
pub type TextRef<'a> = turso_core::types::TextRef<'a>;
pub type Numeric = turso_core::Numeric;
pub type NonNan = turso_core::NonNan;

pub struct TursoLog<'a> {
    pub message: &'a str,
    pub target: &'a str,
    pub file: &'a str,
    pub timestamp: u64,
    pub line: usize,
    pub level: &'a str,
}

type Logger = dyn Fn(TursoLog) + Send + Sync + 'static;
pub struct TursoSetupConfig {
    pub logger: Option<Box<Logger>>,
    pub log_level: Option<String>,
}

fn logger_wrap(log: TursoLog<'_>, logger: unsafe extern "C" fn(*const c::turso_log_t)) {
    let Ok(message_cstr) = std::ffi::CString::new(log.message) else {
        return;
    };
    let Ok(target_cstr) = std::ffi::CString::new(log.target) else {
        return;
    };
    let Ok(file_cstr) = std::ffi::CString::new(log.file) else {
        return;
    };
    unsafe {
        logger(&c::turso_log_t {
            message: message_cstr.as_ptr(),
            target: target_cstr.as_ptr(),
            file: file_cstr.as_ptr(),
            timestamp: log.timestamp,
            line: log.line,
            level: match log.level {
                "TRACE" => capi::c::turso_tracing_level_t::TURSO_TRACING_LEVEL_TRACE,
                "DEBUG" => capi::c::turso_tracing_level_t::TURSO_TRACING_LEVEL_DEBUG,
                "INFO" => capi::c::turso_tracing_level_t::TURSO_TRACING_LEVEL_INFO,
                "WARN" => capi::c::turso_tracing_level_t::TURSO_TRACING_LEVEL_WARN,
                _ => capi::c::turso_tracing_level_t::TURSO_TRACING_LEVEL_ERROR,
            },
        })
    };
}

impl TursoSetupConfig {
    /// helper method to restore [TursoSetupConfig] instance from C representation
    /// this method is used in the capi wrappers
    ///
    /// # Safety
    /// [c::turso_config_t::log_level] field must be valid C-string pointer or null
    pub unsafe fn from_capi(config: *const c::turso_config_t) -> Result<Self, TursoError> {
        if config.is_null() {
            return Err(TursoError::Misuse(
                "config pointer must be not null".to_string(),
            ));
        }
        let config = *config;
        Ok(Self {
            log_level: if !config.log_level.is_null() {
                Some(str_from_c_str(config.log_level)?.to_string())
            } else {
                None
            },
            logger: if let Some(logger) = config.logger {
                Some(Box::new(move |log| logger_wrap(log, logger)))
            } else {
                None
            },
        })
    }
}

#[derive(Clone)]
pub struct TursoDatabaseConfig {
    /// path to the database file or ":memory:" for in-memory connection
    pub path: String,

    /// comma-separated list of experimental features to enable
    /// this field is intentionally just a string in order to make enablement of experimental features as flexible as possible
    pub experimental_features: Option<String>,

    /// if true, library methods will return Io status code and delegate Io loop to the caller
    /// if false, library will spin IO itself in case of Io status code and never return it to the caller
    pub async_io: bool,

    /// optional encryption parameters for local data encryption
    /// as encryption is experimental - [Self::experimental_features] must have "encryption" in the list
    pub encryption: Option<EncryptionOpts>,

    /// optional VFS parameter explicitly specifying FS backend for the database.
    /// Available options are:
    /// - "memory": in-memory backend
    /// - "syscall": generic syscall backend
    /// - "io_uring": IO uring (supported only on Linux)
    pub vfs: Option<String>,

    /// optional custom IO provided by the caller
    pub io: Option<Arc<dyn IO>>,

    /// optional custom DatabaseStorage provided by the caller
    /// if provided, caller must guarantee that IO used by the TursoDatabase will be consistent with underlying DatabaseStorage IO
    pub db_file: Option<Arc<dyn DatabaseStorage>>,
}

pub fn turso_slice_from_bytes(bytes: &[u8]) -> capi::c::turso_slice_ref_t {
    capi::c::turso_slice_ref_t {
        ptr: bytes.as_ptr() as *const std::ffi::c_void,
        len: bytes.len(),
    }
}

pub fn turso_slice_null() -> capi::c::turso_slice_ref_t {
    capi::c::turso_slice_ref_t {
        ptr: std::ptr::null(),
        len: 0,
    }
}

/// # Safety
/// ptr must be valid C-string pointer or null
pub unsafe fn str_from_c_str<'a>(ptr: *const std::ffi::c_char) -> Result<&'a str, TursoError> {
    if ptr.is_null() {
        return Err(TursoError::Misuse(
            "expected zero terminated c string, got null pointer".to_string(),
        ));
    }
    let c_str = std::ffi::CStr::from_ptr(ptr);
    match c_str.to_str() {
        Ok(s) => Ok(s),
        Err(err) => Err(TursoError::Misuse(format!(
            "expected zero terminated c-string representing utf-8 value: {err}"
        ))),
    }
}

/// # Safety
/// memory range [ptr..ptr + len) must be valid
pub unsafe fn str_from_slice<'a>(
    ptr: *const std::ffi::c_char,
    len: usize,
) -> Result<&'a str, TursoError> {
    let slice = bytes_from_slice(ptr, len)?;
    match std::str::from_utf8(slice) {
        Ok(s) => Ok(s),
        Err(err) => Err(TursoError::Misuse(format!(
            "expected string slice representing utf-8 value: {err}"
        ))),
    }
}

/// # Safety
/// memory range [ptr..ptr + len) must be valid
pub unsafe fn bytes_from_slice<'a>(
    ptr: *const std::ffi::c_char,
    len: usize,
) -> Result<&'a [u8], TursoError> {
    if len == 0 {
        return Ok(&[]);
    }
    if ptr.is_null() {
        return Err(TursoError::Misuse(
            "expected slice, got null pointer".to_string(),
        ));
    }
    Ok(std::slice::from_raw_parts(ptr as *const u8, len))
}

/// SAFETY: slice must points to the valid memory
pub fn bytes_from_turso_slice<'a>(
    slice: capi::c::turso_slice_ref_t,
) -> Result<&'a [u8], TursoError> {
    if slice.ptr.is_null() {
        return Err(TursoError::Misuse(
            "expected slice representing utf-8 value, got null".to_string(),
        ));
    }
    Ok(unsafe { std::slice::from_raw_parts(slice.ptr as *const u8, slice.len) })
}

/// SAFETY: slice must points to the valid memory
pub fn str_from_turso_slice<'a>(slice: capi::c::turso_slice_ref_t) -> Result<&'a str, TursoError> {
    if slice.ptr.is_null() {
        return Err(TursoError::Misuse(
            "expected slice representing utf-8 value, got null".to_string(),
        ));
    }
    let s = unsafe { std::slice::from_raw_parts(slice.ptr as *const u8, slice.len) };
    match std::str::from_utf8(s) {
        Ok(s) => Ok(s),
        Err(err) => Err(TursoError::Misuse(format!(
            "expected slice representing utf-8 value: {err}"
        ))),
    }
}

impl TursoDatabaseConfig {
    /// helper method to restore [TursoSetupConfig] instance from C representation
    /// this method is used in the capi wrappers
    ///
    /// # Safety
    /// [c::turso_database_config_t::path] field must be valid C-string pointer
    /// [c::turso_database_config_t::experimental_features] field must be valid C-string pointer or null
    pub unsafe fn from_capi(config: *const c::turso_database_config_t) -> Result<Self, TursoError> {
        if config.is_null() {
            return Err(TursoError::Misuse(
                "config pointer must be not null".to_string(),
            ));
        }
        let config = *config;
        let encryption_cipher = if !config.encryption_cipher.is_null() {
            Some(str_from_c_str(config.encryption_cipher)?.to_string())
        } else {
            None
        };
        let encryption_hexkey = if !config.encryption_hexkey.is_null() {
            Some(str_from_c_str(config.encryption_hexkey)?.to_string())
        } else {
            None
        };
        if encryption_cipher.is_some() != encryption_hexkey.is_some() {
            return Err(TursoError::Misuse(
                "either both encryption cipher and key must be set or no".to_string(),
            ));
        }
        Ok(Self {
            path: str_from_c_str(config.path)?.to_string(),
            experimental_features: if !config.experimental_features.is_null() {
                Some(str_from_c_str(config.experimental_features)?.to_string())
            } else {
                None
            },
            async_io: config.async_io != 0,
            encryption: encryption_cipher.map(|encryption_cipher| EncryptionOpts {
                cipher: encryption_cipher,
                hexkey: encryption_hexkey.unwrap(),
            }),
            vfs: if !config.vfs.is_null() {
                Some(str_from_c_str(config.vfs)?.to_string())
            } else {
                None
            },
            io: None,
            db_file: None,
        })
    }
}

pub struct TursoDatabase {
    config: TursoDatabaseConfig,
    open_state: Mutex<TursoDatabaseOpenState>,
    db: Arc<Mutex<Option<Arc<Database>>>>,
    io: Mutex<Option<Arc<dyn turso_core::IO>>>,
}

/// Phase tracking for async TursoDatabase opening
#[derive(Default, Clone, Copy)]
pub enum TursoDatabaseOpenPhase {
    #[default]
    Init,
    Opening,
    Done,
}

/// State machine for async TursoDatabase opening
pub struct TursoDatabaseOpenState {
    phase: TursoDatabaseOpenPhase,
    io: Option<Arc<dyn IO>>,
    db_file: Option<Arc<dyn DatabaseStorage>>,
    opts: Option<DatabaseOpts>,
    open_db_state: OpenDbAsyncState,
}

impl Default for TursoDatabaseOpenState {
    fn default() -> Self {
        Self::new()
    }
}

impl TursoDatabaseOpenState {
    pub fn new() -> Self {
        Self {
            phase: TursoDatabaseOpenPhase::Init,
            io: None,
            db_file: None,
            opts: None,
            open_db_state: OpenDbAsyncState::new(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum TursoStatusCode {
    Done,
    Row,
    Io,
}

#[derive(Debug, Clone)]
pub enum TursoError {
    Busy(String),
    BusySnapshot(String),
    Interrupt(String),
    Error(String),
    Misuse(String),
    Constraint(String),
    Readonly(String),
    DatabaseFull(String),
    NotAdb(String),
    Corrupt(String),
    IoError(std::io::ErrorKind, &'static str),
}

impl TursoStatusCode {
    pub fn to_capi(self) -> capi::c::turso_status_code_t {
        match self {
            TursoStatusCode::Done => capi::c::turso_status_code_t::TURSO_DONE,
            TursoStatusCode::Row => capi::c::turso_status_code_t::TURSO_ROW,
            TursoStatusCode::Io => capi::c::turso_status_code_t::TURSO_IO,
        }
    }
}

impl TursoError {
    /// # Safety
    /// error_opt_out must be a valid pointer or null
    pub unsafe fn to_capi(
        &self,
        error_opt_out: *mut *const std::ffi::c_char,
    ) -> capi::c::turso_status_code_t {
        if !error_opt_out.is_null() {
            let message = str_to_c_string(&self.to_string());
            unsafe { *error_opt_out = message };
        }
        self.to_capi_code()
    }
    pub fn to_capi_code(&self) -> capi::c::turso_status_code_t {
        match self {
            TursoError::Busy(_) => capi::c::turso_status_code_t::TURSO_BUSY,
            TursoError::BusySnapshot(_) => capi::c::turso_status_code_t::TURSO_BUSY_SNAPSHOT,
            TursoError::Interrupt(_) => capi::c::turso_status_code_t::TURSO_INTERRUPT,
            TursoError::Error(_) => capi::c::turso_status_code_t::TURSO_ERROR,
            TursoError::Misuse(_) => capi::c::turso_status_code_t::TURSO_MISUSE,
            TursoError::Constraint(_) => capi::c::turso_status_code_t::TURSO_CONSTRAINT,
            TursoError::Readonly(_) => capi::c::turso_status_code_t::TURSO_READONLY,
            TursoError::DatabaseFull(_) => capi::c::turso_status_code_t::TURSO_DATABASE_FULL,
            TursoError::NotAdb(_) => capi::c::turso_status_code_t::TURSO_NOTADB,
            TursoError::Corrupt(_) => capi::c::turso_status_code_t::TURSO_CORRUPT,
            TursoError::IoError(..) => capi::c::turso_status_code_t::TURSO_IOERR,
        }
    }
}

impl Display for TursoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TursoError::Busy(s)
            | TursoError::BusySnapshot(s)
            | TursoError::Interrupt(s)
            | TursoError::Error(s)
            | TursoError::Misuse(s)
            | TursoError::Constraint(s)
            | TursoError::Readonly(s)
            | TursoError::DatabaseFull(s)
            | TursoError::NotAdb(s)
            | TursoError::Corrupt(s) => f.write_str(s),
            TursoError::IoError(kind, op) => write!(f, "I/O error ({op}): {kind}"),
        }
    }
}

pub fn str_to_c_string(message: &str) -> *const std::ffi::c_char {
    let Ok(message) = std::ffi::CString::new(message) else {
        return std::ptr::null();
    };
    message.into_raw()
}

pub fn c_string_to_str(ptr: *const std::ffi::c_char) -> std::ffi::CString {
    unsafe { std::ffi::CString::from_raw(ptr as *mut std::ffi::c_char) }
}

impl From<LimboError> for TursoError {
    fn from(value: LimboError) -> Self {
        match value {
            LimboError::ForeignKeyConstraint(e) | LimboError::Constraint(e) => {
                TursoError::Constraint(e)
            }
            LimboError::Corrupt(e) => TursoError::Corrupt(e),
            LimboError::NotADB => TursoError::NotAdb("file is not a database".to_string()),
            LimboError::DatabaseFull(e) => TursoError::DatabaseFull(e),
            LimboError::ReadOnly => TursoError::Readonly("database is readonly".to_string()),
            LimboError::Busy => TursoError::Busy("database is locked".to_string()),
            LimboError::BusySnapshot => TursoError::BusySnapshot(
                "database snapshot is stale, rollback and retry the transaction".to_string(),
            ),
            LimboError::CompletionError(turso_core::CompletionError::IOError(kind, op)) => {
                TursoError::IoError(kind, op)
            }
            _ => TursoError::Error(value.to_string()),
        }
    }
}

static LOGGER: RwLock<Option<Box<Logger>>> = RwLock::new(None);
static SETUP: Once = Once::new();

struct CallbackLayer<F>
where
    F: Fn(TursoLog) + Send + Sync + 'static,
{
    callback: F,
}

impl<S, F> tracing_subscriber::Layer<S> for CallbackLayer<F>
where
    S: tracing::Subscriber + for<'a> tracing_subscriber::registry::LookupSpan<'a>,
    F: Fn(TursoLog) + Send + Sync + 'static,
{
    fn on_event(&self, event: &tracing::Event<'_>, _ctx: Context<'_, S>) {
        let mut buffer = String::new();
        let mut visitor = fmt::format::DefaultVisitor::new(Writer::new(&mut buffer), true);

        event.record(&mut visitor);

        let log = TursoLog {
            level: event.metadata().level().as_str(),
            target: event.metadata().target(),
            message: &buffer,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|t| t.as_secs())
                .unwrap_or(0),
            file: event.metadata().file().unwrap_or(""),
            line: event.metadata().line().unwrap_or(0) as usize,
        };

        (self.callback)(log);
    }
}

pub fn turso_setup(config: TursoSetupConfig) -> Result<(), TursoError> {
    fn callback(log: TursoLog<'_>) {
        let Ok(logger) = LOGGER.try_read() else {
            return;
        };

        if let Some(logger) = logger.as_ref() {
            logger(log)
        }
    }

    if let Some(logger) = config.logger {
        let mut guard = LOGGER.write().unwrap();
        *guard = Some(logger);
    }

    let level_filter = if let Some(log_level) = &config.log_level {
        match log_level.as_ref() {
            "error" => Some(LevelFilter::ERROR),
            "warn" => Some(LevelFilter::WARN),
            "info" => Some(LevelFilter::INFO),
            "debug" => Some(LevelFilter::DEBUG),
            "trace" => Some(LevelFilter::TRACE),
            _ => return Err(TursoError::Error("unknown log level".to_string())),
        }
    } else {
        None
    };

    SETUP.call_once(|| {
        if let Some(level_filter) = level_filter {
            tracing_subscriber::registry()
                .with(CallbackLayer { callback }.with_filter(level_filter))
                .init();
        } else {
            tracing_subscriber::registry()
                .with(CallbackLayer { callback }.with_filter(EnvFilter::from_default_env()))
                .init();
        }
    });

    Ok(())
}

impl TursoDatabase {
    /// return turso version
    pub const fn version() -> &'static str {
        env!("CARGO_PKG_VERSION")
    }
    /// method to get [turso_core::Database] instance which can be useful for code which integrates with sdk-kit
    pub fn db_core(&self) -> Result<Arc<turso_core::Database>, TursoError> {
        let db = self.db.lock().unwrap();
        match &*db {
            Some(db) => Ok(db.clone()),
            None => Err(TursoError::Misuse("database must be opened".to_string())),
        }
    }

    /// method to get [turso_core::IO] instance which can be useful for code which integrates with sdk-kit
    pub fn io(&self) -> Result<Arc<dyn turso_core::IO>, TursoError> {
        let io = self.io.lock().unwrap();
        match &*io {
            Some(io) => Ok(io.clone()),
            None => Err(TursoError::Misuse("io must be opened".to_string())),
        }
    }

    /// create database holder struct but do not initialize it yet
    /// this can be useful for some environments, where IO operations must be executed in certain fashion (and open do IO under the hood)
    pub fn new(config: TursoDatabaseConfig) -> Arc<Self> {
        Arc::new(Self {
            config,
            db: Arc::new(Mutex::new(None)),
            open_state: Mutex::new(TursoDatabaseOpenState::new()),
            io: Mutex::new(None),
        })
    }

    /// Get the config IO or open a new vfs IO from the config
    fn open_vfs_io(&self) -> Result<Arc<dyn turso_core::IO>, TursoError> {
        let io: Arc<dyn turso_core::IO + 'static> = if let Some(io) = &self.config.io {
            io.clone()
        } else {
            match self.config.vfs.as_deref() {
                Some("memory") => Arc::new(turso_core::MemoryIO::new()),
                Some("syscall") => {
                    #[cfg(all(target_family = "unix", not(miri)))]
                    {
                        Arc::new(turso_core::UnixIO::new().map_err(|e| {
                            TursoError::Error(format!(
                                "unable to create generic syscall backend: {e}"
                            ))
                        })?)
                    }
                    #[cfg(any(not(target_family = "unix"), miri))]
                    {
                        Arc::new(turso_core::PlatformIO::new().map_err(|e| {
                            TursoError::Error(format!(
                                "unable to create generic syscall backend: {e}"
                            ))
                        })?)
                    }
                }
                #[cfg(all(target_os = "linux", not(miri)))]
                Some("io_uring") => Arc::new(turso_core::UringIO::new().map_err(|e| {
                    TursoError::Error(format!("unable to create io_uring backend: {e}"))
                })?),
                #[cfg(all(target_os = "windows", not(miri)))]
                Some("experimental_win_iocp") => {
                    Arc::new(turso_core::WindowsIOCP::new().map_err(|e| {
                        TursoError::Error(format!("unable to create win_iocp backend: {e}"))
                    })?)
                }
                #[cfg(any(not(target_os = "linux"), miri))]
                Some("io_uring") => {
                    return Err(TursoError::Error(
                        "io_uring is only available on Linux targets".to_string(),
                    ));
                }
                #[cfg(any(not(target_os = "windows"), miri))]
                Some("experimental_win_iocp") => {
                    return Err(TursoError::Error(
                        "win_iocp is only available on Windows targets".to_string(),
                    ));
                }
                Some(vfs) => {
                    return Err(TursoError::Error(format!(
                        "unsupported VFS backend: '{vfs}'"
                    )))
                }
                None => match self.config.path.as_str() {
                    ":memory:" => Arc::new(turso_core::MemoryIO::new()),
                    _ => Arc::new(turso_core::PlatformIO::new()?),
                },
            }
        };
        Ok(io)
    }

    /// Async version of database opening that returns IOResult.
    /// Caller must drive the IO loop and pass state between calls.
    /// This is useful for environments where IO operations must be executed in a specific fashion.
    pub fn open(&self) -> Result<IOResult<()>, TursoError> {
        loop {
            let mut state = self.open_state.lock().unwrap();
            match state.phase {
                TursoDatabaseOpenPhase::Init => {
                    let inner_db = self.db.lock().unwrap();
                    if inner_db.is_some() {
                        return Err(TursoError::Misuse(
                            "database must be opened only once".to_string(),
                        ));
                    }
                    // keep lock for the whole method since open_async must be called only once and never will be called concurrently

                    let io: Arc<dyn turso_core::IO> = self.open_vfs_io()?;

                    // Store the IO so that it can be retrieved with `io()` call even if the database is still opening
                    *self.io.lock().unwrap() = Some(io.clone());

                    // Opts must be computed BEFORE the file open so we can apply
                    // OpenFlags::NoLock when multiprocess WAL is enabled — taking
                    // the OS-level fcntl lock here would block every other
                    // multiprocess process from opening the same file.
                    let mut opts = DatabaseOpts::new();
                    if let Some(experimental_features) = &self.config.experimental_features {
                        for features in experimental_features.split(",").map(|s| s.trim()) {
                            opts = match features {
                                "views" => opts.with_views(true),
                                "index_method" => opts.with_index_method(true),
                                "strict" => opts, // strict is always enabled, kept for backwards compatibility
                                "custom_types" => opts.with_custom_types(true),
                                "autovacuum" => opts.with_autovacuum(true),
                                "vacuum" => opts.with_vacuum(true),
                                "encryption" => opts.with_encryption(true),
                                "attach" => opts.with_attach(true),
                                "generated_columns" => opts.with_generated_columns(true),
                                "multiprocess_wal" => opts.with_multiprocess_wal(true),
                                _ => opts,
                            };
                        }
                    }

                    if self.config.encryption.is_some() && !opts.enable_encryption {
                        return Err(TursoError::Error(
                            "encryption is experimental and must be explicitly enabled through experimental features list".to_string(),
                        ));
                    }

                    let mut open_flags = OpenFlags::default();
                    if opts.enable_multiprocess_wal {
                        open_flags |= OpenFlags::NoLock;
                    }
                    let db_file = if let Some(db_file) = &self.config.db_file {
                        db_file.clone()
                    } else {
                        let file = io.open_file(&self.config.path, open_flags, true)?;
                        Arc::new(DatabaseFile::new(file))
                    };

                    state.io = Some(io);
                    state.db_file = Some(db_file);
                    state.opts = Some(opts);
                    state.phase = TursoDatabaseOpenPhase::Opening;
                }

                TursoDatabaseOpenPhase::Opening => {
                    let io = state
                        .io
                        .as_ref()
                        .expect("io must be initialized in Init phase")
                        .clone();
                    let db_file = state
                        .db_file
                        .as_ref()
                        .expect("db_file must be initialized in Init phase")
                        .clone();
                    let opts = state.opts.expect("opts must be initialized in Init phase");

                    // PATCH: forward NoLock flag when multiprocess_wal is enabled,
                    // matching what was applied to the .db file open in Init phase.
                    // Without this the .db-wal file gets an exclusive lock that
                    // blocks other processes — defeating the multiprocess feature.
                    let mut db_open_flags = OpenFlags::default();
                    if opts.enable_multiprocess_wal {
                        db_open_flags |= OpenFlags::NoLock;
                    }

                    match Database::open_with_flags_async(
                        &mut state.open_db_state,
                        io.clone(),
                        &self.config.path,
                        db_file,
                        db_open_flags,
                        opts,
                        self.config.encryption.clone(),
                        None,
                    )? {
                        IOResult::Done(db) => {
                            let mut inner_db = self.db.lock().unwrap();
                            *inner_db = Some(db);
                            state.phase = TursoDatabaseOpenPhase::Done;
                            return Ok(IOResult::Done(()));
                        }
                        IOResult::IO(io_completion) => {
                            if self.config.async_io {
                                return Ok(IOResult::IO(io_completion));
                            } else {
                                io_completion.wait(io.deref())?;
                            }
                        }
                    }
                }

                TursoDatabaseOpenPhase::Done => {
                    return Ok(IOResult::Done(()));
                }
            }
        }
    }

    /// creates database connection
    /// database must be already opened with [Self::open] method
    pub fn connect(&self) -> Result<Arc<TursoConnection>, TursoError> {
        let inner_db = self.db.lock().unwrap();
        let Some(db) = inner_db.as_ref() else {
            return Err(TursoError::Misuse(
                "database must be opened first".to_string(),
            ));
        };

        // Parse encryption key if configured - needed for connect_with_encryption
        // which sets up encryption context before reading pages
        let encryption_key = if let Some(ref encryption_opts) = self.config.encryption {
            Some(EncryptionKey::from_hex_string(&encryption_opts.hexkey)?)
        } else {
            None
        };

        // Use connect_with_encryption to properly set up encryption context
        // before the pager reads page 1. This is required for encrypted databases.
        let connection = db.connect_with_encryption(encryption_key)?;

        Ok(TursoConnection::new(&self.config, connection))
    }

    /// helper method to get C raw container with TursoDatabase instance
    /// this method is used in the capi wrappers
    pub fn to_capi(self: Arc<Self>) -> *mut capi::c::turso_database_t {
        Arc::into_raw(self) as *mut capi::c::turso_database_t
    }

    /// helper method to restore TursoDatabase ref from C raw container
    /// this method is used in the capi wrappers
    ///
    /// # Safety
    /// value must be a pointer returned from [Self::to_capi] method
    pub unsafe fn ref_from_capi<'a>(
        value: *const capi::c::turso_database_t,
    ) -> Result<&'a Self, TursoError> {
        if value.is_null() {
            Err(TursoError::Misuse("got null pointer".to_string()))
        } else {
            Ok(&*(value as *const Self))
        }
    }

    /// helper method to restore TursoDatabase instance from C raw container
    /// this method is used in the capi wrappers
    ///
    /// # Safety
    /// value must be a pointer returned from [Self::to_capi] method
    pub unsafe fn arc_from_capi(value: *const capi::c::turso_database_t) -> Arc<Self> {
        Arc::from_raw(value as *const Self)
    }
}

struct CachedStatement {
    program: Arc<turso_core::PreparedProgram>,
    query_mode: QueryMode,
}

#[derive(Clone)]
pub struct TursoConnection {
    async_io: bool,
    concurrent_guard: Arc<ConcurrentGuard>,
    connection: Arc<Connection>,
    cached_statements: Arc<Mutex<HashMap<String, Arc<CachedStatement>>>>,
    /// Weak refs to every statement handle created by this connection, keyed
    /// by a monotonic ID. Statements remove themselves on drop, so this map
    /// only ever contains live entries. `close()` upgrades each remaining
    /// handle and sets it to `None` to release `Arc<Connection>` → `Arc<Database>`.
    stmts: StmtRegistry,
    next_stmt_id: Arc<AtomicUsize>,
}

impl TursoConnection {
    pub fn new(config: &TursoDatabaseConfig, connection: Arc<Connection>) -> Arc<Self> {
        Arc::new(Self {
            async_io: config.async_io,
            connection,
            concurrent_guard: Arc::new(ConcurrentGuard::new()),
            cached_statements: Arc::new(Mutex::new(HashMap::new())),
            stmts: Arc::new(Mutex::new(HashMap::new())),
            next_stmt_id: Arc::new(AtomicUsize::new(0)),
        })
    }
    /// Set busy timeout for the connection
    pub fn set_busy_timeout(&self, duration: Duration) {
        self.connection.set_busy_timeout(duration);
    }
    pub fn get_auto_commit(&self) -> bool {
        self.connection.get_auto_commit()
    }
    pub fn last_insert_rowid(&self) -> i64 {
        self.connection.last_insert_rowid()
    }

    /// prepares single SQL statement
    pub fn prepare_single(&self, sql: impl AsRef<str>) -> Result<Box<TursoStatement>, TursoError> {
        let statement = self.connection.prepare(sql)?;
        let handle: StatementHandle = Arc::new(Mutex::new(Some(statement)));
        let stmt_id = self.track_stmt(&handle);
        Ok(Box::new(TursoStatement {
            concurrent_guard: self.concurrent_guard.clone(),
            async_io: self.async_io,
            handle,
            stmt_id,
            stmts: self.stmts.clone(),
        }))
    }

    /// Prepare a statement from the provided SQL string and cache it for future use.
    pub fn prepare_cached(&self, sql: impl AsRef<str>) -> Result<Box<TursoStatement>, TursoError> {
        let sql_str = sql.as_ref();

        // Check if we have a cached version
        if let Some(cached) = self.cached_statements.lock().unwrap().get(sql_str) {
            if cached.program.is_compatible_with(&self.connection) {
                let program = turso_core::Program::from_prepared(
                    cached.program.clone(),
                    self.connection.clone(),
                );
                let statement =
                    Statement::new(program, self.connection.get_pager(), cached.query_mode, 0);
                let handle: StatementHandle = Arc::new(Mutex::new(Some(statement)));
                let stmt_id = self.track_stmt(&handle);
                return Ok(Box::new(TursoStatement {
                    concurrent_guard: self.concurrent_guard.clone(),
                    async_io: self.async_io,
                    handle,
                    stmt_id,
                    stmts: self.stmts.clone(),
                }));
            }
        }

        // Not cached, prepare it fresh
        let statement = self.connection.prepare(sql_str)?;

        // Cache it for future use
        let cached = Arc::new(CachedStatement {
            program: statement.get_program().prepared().clone(),
            query_mode: statement.get_query_mode(),
        });
        self.cached_statements
            .lock()
            .unwrap()
            .insert(sql_str.to_string(), cached);

        let handle: StatementHandle = Arc::new(Mutex::new(Some(statement)));
        let stmt_id = self.track_stmt(&handle);
        Ok(Box::new(TursoStatement {
            concurrent_guard: self.concurrent_guard.clone(),
            async_io: self.async_io,
            handle,
            stmt_id,
            stmts: self.stmts.clone(),
        }))
    }

    /// prepares first SQL statement from the string and return prepared statement and position after the end of the parsed statement
    /// this method can be useful if SDK provides an execute(...) method which run all statements from the provided input in sequence
    pub fn prepare_first(
        &self,
        sql: impl AsRef<str>,
    ) -> Result<Option<(Box<TursoStatement>, usize)>, TursoError> {
        match self.connection.consume_stmt(sql)? {
            Some((statement, position)) => {
                let handle: StatementHandle = Arc::new(Mutex::new(Some(statement)));
                let stmt_id = self.track_stmt(&handle);
                Ok(Some((
                    Box::new(TursoStatement {
                        async_io: self.async_io,
                        concurrent_guard: Arc::new(ConcurrentGuard::new()),
                        handle,
                        stmt_id,
                        stmts: self.stmts.clone(),
                    }),
                    position,
                )))
            }
            None => Ok(None),
        }
    }

    /// close the connection preventing any further operations executed over it
    /// SAFETY: caller must guarantee that no ongoing operations are running over connection before calling close(...) method
    pub fn close(&self) -> Result<(), TursoError> {
        // Finalize all outstanding statements to release their Arc chain:
        // Statement → Program → Arc<Connection> → Arc<Database>.
        // Without this, un-finalized statements keep the Database alive in
        // DATABASE_MANAGER, causing stale databases after file renames.
        let mut stmts = self.stmts.lock().unwrap();
        for (_id, weak) in stmts.drain() {
            if let Some(handle) = weak.upgrade() {
                // Setting to None drops the turso_core::Statement,
                // releasing Arc<Connection> → Arc<Database>.
                *handle.lock().unwrap() = None;
            }
        }
        self.connection.close()?;
        Ok(())
    }

    /// low-level method used only by the Rust SDK
    pub fn cacheflush(&self) -> Result<(), TursoError> {
        let completions = self.connection.cacheflush()?;
        let pager = self.connection.get_pager();
        for c in completions {
            pager.io.wait_for_completion(c)?;
        }
        Ok(())
    }

    /// helper method to get C raw container to the TursoConnection instance
    /// this method is used in the capi wrappers
    pub fn to_capi(self: Arc<Self>) -> *mut capi::c::turso_connection_t {
        Arc::into_raw(self) as *mut capi::c::turso_connection_t
    }

    /// helper method to restore TursoConnection ref from C raw container
    /// this method is used in the capi wrappers
    ///
    /// # Safety
    /// value must be a pointer returned from [Self::to_capi] method
    pub unsafe fn ref_from_capi<'a>(
        value: *const capi::c::turso_connection_t,
    ) -> Result<&'a Self, TursoError> {
        if value.is_null() {
            Err(TursoError::Misuse("got null pointer".to_string()))
        } else {
            Ok(&*(value as *const Self))
        }
    }

    /// helper method to restore TursoConnection instance from C raw container
    /// this method is used in the capi wrappers
    ///
    /// # Safety
    /// value must be a pointer returned from [Self::to_capi] method
    pub unsafe fn arc_from_capi(value: *const capi::c::turso_connection_t) -> Arc<Self> {
        Arc::from_raw(value as *const Self)
    }

    /// Register a statement handle and return its ID. The statement removes
    /// itself from the registry on drop via its `stmt_id` + `stmts` ref.
    fn track_stmt(&self, handle: &StatementHandle) -> usize {
        let id = self.next_stmt_id.fetch_add(1, Ordering::Relaxed);
        self.stmts
            .lock()
            .unwrap()
            .insert(id, Arc::downgrade(handle));
        id
    }
}

/// Shared ownership of a `turso_core::Statement` that can be explicitly finalized.
/// When the inner `Option` is set to `None`, the statement is considered finalized
/// and all operations on it will return errors / defaults.
pub(crate) type StatementHandle = Arc<Mutex<Option<Statement>>>;
type StmtRegistry = Arc<Mutex<HashMap<usize, Weak<Mutex<Option<Statement>>>>>>;

const FINALIZED_ERR: &str = "statement has been finalized";

/// Advance one step of a statement's execution.
/// Factored out of `TursoStatement` so it can be called while holding
/// the `StatementHandle` lock without re-entrancy issues.
fn step_inner(
    stmt: &mut Statement,
    async_io: bool,
    waker: Option<&Waker>,
) -> Result<TursoStatusCode, TursoError> {
    loop {
        let result = if let Some(waker) = waker {
            stmt.step_with_waker(waker)
        } else {
            stmt.step()
        };
        return match result? {
            StepResult::Done => Ok(TursoStatusCode::Done),
            StepResult::Row => Ok(TursoStatusCode::Row),
            StepResult::Busy => Err(TursoError::Busy("database is locked".to_string())),
            StepResult::Interrupt => Err(TursoError::Interrupt("interrupted".to_string())),
            StepResult::IO => {
                if async_io {
                    Ok(TursoStatusCode::Io)
                } else {
                    stmt._io().step()?;
                    continue;
                }
            }
        };
    }
}

pub struct TursoStatement {
    async_io: bool,
    concurrent_guard: Arc<ConcurrentGuard>,
    pub(crate) handle: StatementHandle,
    stmt_id: usize,
    stmts: StmtRegistry,
}

impl Drop for TursoStatement {
    fn drop(&mut self) {
        self.stmts.lock().unwrap().remove(&self.stmt_id);
    }
}

#[derive(Debug, Clone)]
pub struct TursoExecutionResult {
    pub status: TursoStatusCode,
    pub rows_changed: u64,
}

impl TursoStatement {
    /// return amount of row modifications (insert/delete operations) made by the most recent executed statement
    pub fn n_change(&self) -> i64 {
        let handle = self.handle.lock().unwrap();
        match handle.as_ref() {
            Some(stmt) => stmt.n_change(),
            None => 0,
        }
    }
    /// returns parameters count for the statement
    pub fn parameters_count(&self) -> usize {
        let handle = self.handle.lock().unwrap();
        match handle.as_ref() {
            Some(stmt) => stmt.parameters_count(),
            None => 0,
        }
    }
    /// Returns the name of the parameter at the given 1-based index,
    /// including its SQL prefix (e.g. `:name`, `@name`, `$name`).
    /// Returns None for positional-only (`?`) parameters or out-of-range indices.
    pub fn parameter_name(&self, index: usize) -> Option<String> {
        let handle = self.handle.lock().unwrap();
        let stmt = handle.as_ref()?;
        let index = index.try_into().ok()?;
        stmt.parameters().name(index)
    }
    /// binds positional parameter at the corresponding index (1-based)
    pub fn bind_positional(
        &mut self,
        index: usize,
        value: turso_core::Value,
    ) -> Result<(), TursoError> {
        let mut handle = self.handle.lock().unwrap();
        let stmt = handle
            .as_mut()
            .ok_or_else(|| TursoError::Misuse(FINALIZED_ERR.to_string()))?;
        let Ok(index) = index.try_into() else {
            return Err(TursoError::Misuse(
                "bind index must be non-zero".to_string(),
            ));
        };
        if !stmt.parameters().has_slot(index) {
            return Err(TursoError::Misuse(format!(
                "bind index {index} is out of bounds"
            )));
        }
        stmt.bind_at(index, value);
        Ok(())
    }
    /// named parameter position.
    ///
    /// The name must include the SQL placeholder prefix, e.g. `:name`, `@name`, `$name`, or `?1`.
    pub fn named_position(&mut self, name: impl AsRef<str>) -> Result<usize, TursoError> {
        let handle = self.handle.lock().unwrap();
        let stmt = handle
            .as_ref()
            .ok_or_else(|| TursoError::Misuse(FINALIZED_ERR.to_string()))?;
        let name = name.as_ref();
        if let Some(index) = stmt.parameter_index(name) {
            return Ok(index.into());
        }

        if name.starts_with('?') {
            let maybe_index = name
                .strip_prefix('?')
                .and_then(|value| value.parse::<usize>().ok())
                .and_then(|value| value.try_into().ok());
            if let Some(index) = maybe_index {
                if stmt.parameters().is_indexed(index) {
                    return Ok(index.into());
                }
            }
        }

        Err(TursoError::Error(format!(
            "named parameter {name} not found"
        )))
    }
    /// make one execution step of the statement
    /// method returns [TursoStatusCode::Done] if execution is finished
    /// method returns [TursoStatusCode::Row] if execution generated a row
    /// method returns [TursoStatusCode::Io] if async_io was set and execution needs IO in order to make progress
    #[inline]
    pub fn step(&mut self, waker: Option<&Waker>) -> Result<TursoStatusCode, TursoError> {
        let guard = self.concurrent_guard.clone();
        let _guard = guard.try_use()?;
        let mut handle = self.handle.lock().unwrap();
        let stmt = handle
            .as_mut()
            .ok_or_else(|| TursoError::Misuse(FINALIZED_ERR.to_string()))?;
        step_inner(stmt, self.async_io, waker)
    }

    /// execute statement to completion
    /// method returns [TursoStatusCode::Done] if execution completed
    /// method returns [TursoStatusCode::Io] if async_io was set and execution needs IO in order to make progress
    pub fn execute(&mut self, waker: Option<&Waker>) -> Result<TursoExecutionResult, TursoError> {
        let guard = self.concurrent_guard.clone();
        let _guard = guard.try_use()?;
        let mut handle = self.handle.lock().unwrap();
        let stmt = handle
            .as_mut()
            .ok_or_else(|| TursoError::Misuse(FINALIZED_ERR.to_string()))?;

        loop {
            let status = step_inner(stmt, self.async_io, waker)?;
            if status == TursoStatusCode::Row {
                continue;
            } else if status == TursoStatusCode::Io {
                return Ok(TursoExecutionResult {
                    status,
                    rows_changed: 0,
                });
            } else if status == TursoStatusCode::Done {
                return Ok(TursoExecutionResult {
                    status: TursoStatusCode::Done,
                    rows_changed: stmt.n_change() as u64,
                });
            }
            return Err(TursoError::Error(format!(
                "internal error: unexpected status code: {status:?}",
            )));
        }
    }
    /// run iteration of the IO backend
    pub fn run_io(&self) -> Result<(), TursoError> {
        let handle = self.handle.lock().unwrap();
        let stmt = handle
            .as_ref()
            .ok_or_else(|| TursoError::Misuse(FINALIZED_ERR.to_string()))?;
        stmt._io().step()?;
        Ok(())
    }
    /// get row value as an owned Value
    #[inline]
    pub fn row_value(&self, index: usize) -> Result<turso_core::Value, TursoError> {
        let handle = self.handle.lock().unwrap();
        let stmt = handle
            .as_ref()
            .ok_or_else(|| TursoError::Misuse(FINALIZED_ERR.to_string()))?;
        let Some(row) = stmt.row() else {
            return Err(TursoError::Misuse("statement holds no row".to_string()));
        };
        if index >= row.len() {
            return Err(TursoError::Misuse(
                "attempt to access row value out of bounds".to_string(),
            ));
        }
        Ok(row.get_value(index).as_value_ref().to_owned())
    }
    /// returns column count
    pub fn column_count(&self) -> usize {
        let handle = self.handle.lock().unwrap();
        match handle.as_ref() {
            Some(stmt) => stmt.num_columns(),
            None => 0,
        }
    }
    /// returns column name
    pub fn column_name(&self, index: usize) -> Result<String, TursoError> {
        let handle = self.handle.lock().unwrap();
        let stmt = handle
            .as_ref()
            .ok_or_else(|| TursoError::Misuse(FINALIZED_ERR.to_string()))?;
        if index >= stmt.num_columns() {
            return Err(TursoError::Misuse("column index out of bounds".to_string()));
        }
        Ok(stmt.get_column_name(index).into_owned())
    }
    /// returns column declared type (e.g. "INTEGER", "TEXT", "DATETIME", etc.)
    pub fn column_decltype(&self, index: usize) -> Option<String> {
        let handle = self.handle.lock().unwrap();
        let stmt = handle.as_ref()?;
        if index >= stmt.num_columns() {
            return None;
        }
        stmt.get_column_decltype(index)
    }
    /// finalize statement execution
    /// this method must be called in the end of statement execution (either successfull or not)
    pub fn finalize(&mut self, waker: Option<&Waker>) -> Result<TursoStatusCode, TursoError> {
        let guard = self.concurrent_guard.clone();
        let _guard = guard.try_use()?;
        let mut handle = self.handle.lock().unwrap();
        if let Some(stmt) = handle.as_mut() {
            while stmt.execution_state().is_running() {
                let status = step_inner(stmt, self.async_io, waker)?;
                if status == TursoStatusCode::Io {
                    return Ok(status);
                }
            }
        }
        // Drop the inner statement to release the Arc chain
        *handle = None;
        Ok(TursoStatusCode::Done)
    }
    /// reset internal statement state and bindings
    pub fn reset(&mut self) -> Result<(), TursoError> {
        let mut handle = self.handle.lock().unwrap();
        let stmt = handle
            .as_mut()
            .ok_or_else(|| TursoError::Misuse(FINALIZED_ERR.to_string()))?;
        stmt.reset()?;
        stmt.clear_bindings();
        Ok(())
    }

    /// helper method to get C raw container to the TursoStatement instance
    /// this method is used in the capi wrappers
    pub fn to_capi(self: Box<Self>) -> *mut capi::c::turso_statement_t {
        Box::into_raw(self) as *mut capi::c::turso_statement_t
    }

    /// helper method to restore TursoStatement ref from C raw container
    /// this method is used in the capi wrappers
    ///
    /// # Safety
    /// value must be a pointer returned from [Self::to_capi] method
    pub unsafe fn ref_from_capi<'a>(
        value: *const capi::c::turso_statement_t,
    ) -> Result<&'a mut Self, TursoError> {
        if value.is_null() {
            Err(TursoError::Misuse("got null pointer".to_string()))
        } else {
            Ok(&mut *(value as *mut Self))
        }
    }

    /// helper method to restore TursoStatement instance from C raw container
    /// this method is used in the capi wrappers
    ///
    /// # Safety
    /// value must be a pointer returned from [Self::to_capi] method
    pub unsafe fn box_from_capi(value: *const capi::c::turso_statement_t) -> Box<Self> {
        Box::from_raw(value as *mut Self)
    }
}

#[cfg(test)]
mod tests {
    use crate::rsapi::{
        TursoDatabase, TursoDatabaseConfig, TursoError, TursoStatusCode, FINALIZED_ERR,
    };
    use turso_core::Value;

    #[test]
    pub fn test_db_concurrent_use() {
        use std::sync::{Arc, Barrier};

        let mut errors = Vec::new();
        for _ in 0..16 {
            let db = TursoDatabase::new(TursoDatabaseConfig {
                path: ":memory:".to_string(),
                experimental_features: None,
                async_io: false,
                encryption: None,
                vfs: None,
                io: None,
                db_file: None,
            });
            let result = db.open().unwrap();
            assert!(!result.is_io());
            let conn = db.connect().unwrap();
            let stmt1 = conn
                .prepare_single("SELECT * FROM generate_series(1, 100000)")
                .unwrap();
            let stmt2 = conn
                .prepare_single("SELECT * FROM generate_series(1, 100000)")
                .unwrap();

            // Use a barrier to ensure both threads start executing at the same time
            let barrier = Arc::new(Barrier::new(2));
            let mut threads = Vec::new();
            for mut stmt in [stmt1, stmt2] {
                let barrier_clone = Arc::clone(&barrier);
                let thread = std::thread::spawn(move || {
                    barrier_clone.wait();
                    stmt.execute(None)
                });
                threads.push(thread);
            }
            let mut results = Vec::new();
            for thread in threads {
                results.push(thread.join().unwrap());
            }
            assert!(
                !(results[0].is_err() && results[1].is_err()),
                "results: {results:?}",
            );
            if results[0].is_err() || results[1].is_err() {
                errors.push(
                    results[0]
                        .clone()
                        .err()
                        .or(results[1].clone().err())
                        .unwrap(),
                );
            }
        }
        println!("{errors:?}");
        assert!(
            !errors.is_empty(),
            "misuse errors should be very likely with the test setup: {errors:?}"
        );
        assert!(
            errors.iter().all(|e| matches!(e, TursoError::Misuse(_))),
            "all errors must have Misuse code: {errors:?}"
        );
    }

    #[test]
    pub fn test_db_rsapi_use() {
        let db = TursoDatabase::new(TursoDatabaseConfig {
            path: ":memory:".to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let result = db.open().unwrap();
        assert!(!result.is_io());
        let conn = db.connect().unwrap();
        let mut stmt = conn
            .prepare_single("SELECT * FROM generate_series(1, 10000)")
            .unwrap();
        assert_eq!(stmt.execute(None).unwrap().status, TursoStatusCode::Done);
    }

    #[test]
    pub fn test_named_position_requires_prefixed_name() {
        let db = TursoDatabase::new(TursoDatabaseConfig {
            path: ":memory:".to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let result = db.open().unwrap();
        assert!(!result.is_io());

        let conn = db.connect().unwrap();
        let mut stmt = conn
            .prepare_single("SELECT :new_name, @other_name, $third_name")
            .unwrap();

        assert_eq!(stmt.named_position(":new_name").unwrap(), 1);
        assert!(stmt.named_position("new_name").is_err());
        assert!(stmt.named_position("?1").is_err());

        assert_eq!(stmt.named_position("@other_name").unwrap(), 2);
        assert!(stmt.named_position("other_name").is_err());

        assert_eq!(stmt.named_position("$third_name").unwrap(), 3);
        assert!(stmt.named_position("third_name").is_err());
    }

    #[test]
    pub fn test_bind_positional_rejects_out_of_bounds_index() {
        let db = TursoDatabase::new(TursoDatabaseConfig {
            path: ":memory:".to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let result = db.open().unwrap();
        assert!(!result.is_io());

        let conn = db.connect().unwrap();
        let mut stmt = conn.prepare_single("SELECT ?1").unwrap();

        stmt.bind_positional(1, Value::from_i64(42)).unwrap();

        let err = stmt.bind_positional(2, Value::from_i64(7)).unwrap_err();
        assert!(matches!(err, TursoError::Misuse(_)));
    }

    #[test]
    pub fn test_execute_update_with_prefixed_named_parameters() {
        let db = TursoDatabase::new(TursoDatabaseConfig {
            path: ":memory:".to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let result = db.open().unwrap();
        assert!(!result.is_io());

        let conn = db.connect().unwrap();

        let mut create_stmt = conn
            .prepare_single("CREATE TABLE simple (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
            .unwrap();
        assert_eq!(
            create_stmt.execute(None).unwrap().status,
            TursoStatusCode::Done
        );

        let mut insert_stmt = conn
            .prepare_single("INSERT INTO simple (name) VALUES ('original_name')")
            .unwrap();
        assert_eq!(
            insert_stmt.execute(None).unwrap().status,
            TursoStatusCode::Done
        );

        let mut update_stmt = conn
            .prepare_single("UPDATE simple SET name = :new_name WHERE name = :old_name")
            .unwrap();

        let new_name_position = update_stmt.named_position(":new_name").unwrap();
        update_stmt
            .bind_positional(new_name_position, Value::build_text("updated_name"))
            .unwrap();
        let old_name_position = update_stmt.named_position(":old_name").unwrap();
        update_stmt
            .bind_positional(old_name_position, Value::build_text("original_name"))
            .unwrap();

        let update_result = update_stmt.execute(None).unwrap();
        assert_eq!(update_result.status, TursoStatusCode::Done);
        assert_eq!(update_result.rows_changed, 1);
    }

    #[test]
    pub fn test_execute_update_with_mixed_placeholders() {
        let db = TursoDatabase::new(TursoDatabaseConfig {
            path: ":memory:".to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let result = db.open().unwrap();
        assert!(!result.is_io());

        let conn = db.connect().unwrap();

        let mut create_stmt = conn
            .prepare_single("CREATE TABLE mixed (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER)")
            .unwrap();
        assert_eq!(
            create_stmt.execute(None).unwrap().status,
            TursoStatusCode::Done
        );

        let mut insert_stmt = conn
            .prepare_single(
                "INSERT INTO mixed (name, email, age) VALUES ('alice', 'alice@old.com', 25)",
            )
            .unwrap();
        assert_eq!(
            insert_stmt.execute(None).unwrap().status,
            TursoStatusCode::Done
        );

        let mut update_stmt = conn
            .prepare_single("UPDATE mixed SET email = ?, age = :new_age WHERE name = ?")
            .unwrap();

        assert_eq!(update_stmt.named_position("?1").unwrap(), 1);
        assert_eq!(update_stmt.named_position(":new_age").unwrap(), 2);
        assert!(update_stmt.named_position("new_age").is_err());
        assert_eq!(update_stmt.named_position("?3").unwrap(), 3);

        update_stmt
            .bind_positional(1, Value::build_text("alice@new.com"))
            .unwrap();
        let age_position = update_stmt.named_position(":new_age").unwrap();
        update_stmt
            .bind_positional(age_position, Value::from_i64(30))
            .unwrap();
        update_stmt
            .bind_positional(3, Value::build_text("alice"))
            .unwrap();

        let update_result = update_stmt.execute(None).unwrap();
        assert_eq!(update_result.status, TursoStatusCode::Done);
        assert_eq!(update_result.rows_changed, 1);
    }

    #[test]
    pub fn test_select_named_and_positional_mapping_stays_sql_order() {
        let db = TursoDatabase::new(TursoDatabaseConfig {
            path: ":memory:".to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let result = db.open().unwrap();
        assert!(!result.is_io());

        let conn = db.connect().unwrap();
        let mut create_stmt = conn
            .prepare_single("CREATE TABLE simple (name TEXT NOT NULL)")
            .unwrap();
        assert_eq!(
            create_stmt.execute(None).unwrap().status,
            TursoStatusCode::Done
        );

        let mut stmt = conn
            .prepare_single("SELECT :named FROM simple WHERE name = ?")
            .unwrap();

        assert_eq!(stmt.named_position(":named").unwrap(), 1);
        assert!(stmt.named_position("named").is_err());
        assert_eq!(stmt.named_position("?2").unwrap(), 2);
    }

    #[test]
    pub fn test_named_and_indexed_alias_share_slot() {
        let db = TursoDatabase::new(TursoDatabaseConfig {
            path: ":memory:".to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let result = db.open().unwrap();
        assert!(!result.is_io());

        let conn = db.connect().unwrap();
        let mut stmt = conn
            .prepare_single("SELECT :v AS named_slot, ?1 AS pos_slot")
            .unwrap();

        assert_eq!(stmt.named_position(":v").unwrap(), 1);
        assert!(stmt.named_position("v").is_err());
        assert!(stmt.named_position("?1").is_err());

        stmt.bind_positional(1, Value::from_i64(7)).unwrap();
        assert_eq!(stmt.step(None).unwrap(), TursoStatusCode::Row);
        assert_eq!(stmt.row_value(0).unwrap().as_int(), Some(7));
        assert_eq!(stmt.row_value(1).unwrap().as_int(), Some(7));
    }

    #[test]
    pub fn test_sparse_positional_index_uses_declared_slot() {
        let db = TursoDatabase::new(TursoDatabaseConfig {
            path: ":memory:".to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let result = db.open().unwrap();
        assert!(!result.is_io());

        let conn = db.connect().unwrap();
        let mut stmt = conn.prepare_single("SELECT ?3").unwrap();

        assert_eq!(stmt.parameters_count(), 3);
        stmt.bind_positional(1, Value::from_i64(1)).unwrap();

        stmt.bind_positional(3, Value::from_i64(9)).unwrap();
        assert_eq!(stmt.step(None).unwrap(), TursoStatusCode::Row);
        assert_eq!(stmt.row_value(0).unwrap().as_int(), Some(9));
    }

    #[test]
    pub fn test_sparse_positional_index_count_matches_sqlite() {
        let db = TursoDatabase::new(TursoDatabaseConfig {
            path: ":memory:".to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let result = db.open().unwrap();
        assert!(!result.is_io());

        let conn = db.connect().unwrap();
        let mut stmt = conn.prepare_single("SELECT ?3").unwrap();

        assert_eq!(stmt.parameters_count(), 3);
        assert!(stmt.named_position("?1").is_err());
        assert_eq!(stmt.named_position("?3").unwrap(), 3);

        stmt.bind_positional(3, Value::from_i64(11)).unwrap();
        assert_eq!(stmt.step(None).unwrap(), TursoStatusCode::Row);
        assert_eq!(stmt.row_value(0).unwrap().as_int(), Some(11));
    }

    #[test]
    pub fn test_insert_with_mixed_placeholders() {
        let db = TursoDatabase::new(TursoDatabaseConfig {
            path: ":memory:".to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let result = db.open().unwrap();
        assert!(!result.is_io());

        let conn = db.connect().unwrap();
        let mut create_stmt = conn
            .prepare_single("CREATE TABLE users (name TEXT NOT NULL, age INTEGER NOT NULL)")
            .unwrap();
        assert_eq!(
            create_stmt.execute(None).unwrap().status,
            TursoStatusCode::Done
        );

        let mut insert_stmt = conn
            .prepare_single("INSERT INTO users (name, age) VALUES (?, :age)")
            .unwrap();

        assert_eq!(insert_stmt.named_position("?1").unwrap(), 1);
        assert_eq!(insert_stmt.named_position(":age").unwrap(), 2);
        assert!(insert_stmt.named_position("age").is_err());

        insert_stmt
            .bind_positional(1, Value::build_text("alice"))
            .unwrap();
        let age_position = insert_stmt.named_position(":age").unwrap();
        insert_stmt
            .bind_positional(age_position, Value::from_i64(30))
            .unwrap();

        let insert_result = insert_stmt.execute(None).unwrap();
        assert_eq!(insert_result.status, TursoStatusCode::Done);
        assert_eq!(insert_result.rows_changed, 1);

        let mut verify_stmt = conn
            .prepare_single("SELECT age FROM users WHERE name = 'alice'")
            .unwrap();
        assert_eq!(verify_stmt.step(None).unwrap(), TursoStatusCode::Row);
        assert_eq!(verify_stmt.row_value(0).unwrap().as_int(), Some(30));
    }

    #[test]
    pub fn test_delete_with_mixed_placeholders() {
        let db = TursoDatabase::new(TursoDatabaseConfig {
            path: ":memory:".to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let result = db.open().unwrap();
        assert!(!result.is_io());

        let conn = db.connect().unwrap();
        let mut create_stmt = conn
            .prepare_single("CREATE TABLE users (name TEXT NOT NULL, age INTEGER NOT NULL)")
            .unwrap();
        assert_eq!(
            create_stmt.execute(None).unwrap().status,
            TursoStatusCode::Done
        );

        let mut seed_stmt = conn
            .prepare_single("INSERT INTO users (name, age) VALUES ('alice', 30), ('bob', 40)")
            .unwrap();
        assert_eq!(
            seed_stmt.execute(None).unwrap().status,
            TursoStatusCode::Done
        );

        let mut delete_stmt = conn
            .prepare_single("DELETE FROM users WHERE name = ? AND age = :age")
            .unwrap();

        assert_eq!(delete_stmt.named_position("?1").unwrap(), 1);
        assert_eq!(delete_stmt.named_position(":age").unwrap(), 2);
        assert!(delete_stmt.named_position("age").is_err());

        delete_stmt
            .bind_positional(1, Value::build_text("alice"))
            .unwrap();
        let age_position = delete_stmt.named_position(":age").unwrap();
        delete_stmt
            .bind_positional(age_position, Value::from_i64(30))
            .unwrap();

        let delete_result = delete_stmt.execute(None).unwrap();
        assert_eq!(delete_result.status, TursoStatusCode::Done);
        assert_eq!(delete_result.rows_changed, 1);

        let mut verify_stmt = conn.prepare_single("SELECT count(*) FROM users").unwrap();
        assert_eq!(verify_stmt.step(None).unwrap(), TursoStatusCode::Row);
        assert_eq!(verify_stmt.row_value(0).unwrap().as_int(), Some(1));
    }

    #[cfg(feature = "encryption")]
    mod encryption_tests {
        use super::*;
        use tempfile::NamedTempFile;

        const TEST_CIPHER: &str = "aes256gcm";
        const TEST_HEXKEY: &str =
            "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
        const WRONG_HEXKEY: &str =
            "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

        fn create_encryption_opts() -> crate::rsapi::EncryptionOpts {
            crate::rsapi::EncryptionOpts {
                cipher: TEST_CIPHER.to_string(),
                hexkey: TEST_HEXKEY.to_string(),
            }
        }

        fn assert_integer(value: turso_core::Value, expected: i64) {
            match value {
                turso_core::Value::Numeric(turso_core::Numeric::Integer(i)) => {
                    assert_eq!(i, expected)
                }
                _ => panic!("Expected integer {expected}, got {value:?}"),
            }
        }

        #[test]
        fn test_encryption() {
            let temp_file = NamedTempFile::new().unwrap();
            let db_path = temp_file.path().to_str().unwrap();

            // 1. Create encrypted database and insert data
            {
                let db = TursoDatabase::new(TursoDatabaseConfig {
                    path: db_path.to_string(),
                    experimental_features: Some("encryption".to_string()),
                    async_io: false,
                    encryption: Some(create_encryption_opts()),
                    vfs: None,
                    io: None,
                    db_file: None,
                });
                let result = db.open().unwrap();
                assert!(!result.is_io());
                let conn = db.connect().unwrap();

                let mut stmt = conn
                    .prepare_single("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)")
                    .unwrap();
                stmt.execute(None).unwrap();

                let mut stmt = conn
                    .prepare_single("INSERT INTO test (id, value) VALUES (1, 'secret_data')")
                    .unwrap();
                stmt.execute(None).unwrap();

                // Checkpoint to ensure data is written to main db file
                let mut stmt = conn
                    .prepare_single("PRAGMA wal_checkpoint(TRUNCATE)")
                    .unwrap();
                stmt.execute(None).unwrap();
            }

            // 2. Verify data is encrypted on disk
            let content = std::fs::read(db_path).unwrap();
            assert!(content.len() > 1024);
            assert!(
                !content.windows(11).any(|w| w == b"secret_data"),
                "Plaintext should not appear in encrypted database file"
            );

            // 3. Reopen with correct key and verify data
            {
                let db = TursoDatabase::new(TursoDatabaseConfig {
                    path: db_path.to_string(),
                    experimental_features: Some("encryption".to_string()),
                    async_io: false,
                    encryption: Some(create_encryption_opts()),
                    vfs: None,
                    io: None,
                    db_file: None,
                });
                let result = db.open().unwrap();
                assert!(!result.is_io());
                let conn = db.connect().unwrap();

                let mut stmt = conn
                    .prepare_single("SELECT id, value FROM test WHERE id = 1")
                    .unwrap();
                assert_eq!(stmt.step(None).unwrap(), TursoStatusCode::Row);
                assert_integer(stmt.row_value(0).unwrap(), 1);
                assert_eq!(stmt.row_value(1).unwrap().to_text(), Some("secret_data"));
            }

            // 4. Verify opening with wrong key fails
            {
                let db = TursoDatabase::new(TursoDatabaseConfig {
                    path: db_path.to_string(),
                    experimental_features: Some("encryption".to_string()),
                    async_io: false,
                    encryption: Some(crate::rsapi::EncryptionOpts {
                        cipher: TEST_CIPHER.to_string(),
                        hexkey: WRONG_HEXKEY.to_string(),
                    }),
                    vfs: None,
                    io: None,
                    db_file: None,
                });
                assert!(db.open().is_err(), "Opening with wrong key should fail");
            }

            // 5. Verify opening without encryption fails
            {
                let db = TursoDatabase::new(TursoDatabaseConfig {
                    path: db_path.to_string(),
                    experimental_features: Some("encryption".to_string()),
                    async_io: false,
                    encryption: None,
                    vfs: None,
                    io: None,
                    db_file: None,
                });
                let result = db.open();
                println!("result: {result:?}");
                assert!(
                    result.is_err(),
                    "Opening encrypted database without key should fail"
                );
            }
        }
    }

    /// Reproducer: stale DATABASE_MANAGER entry when old TursoDatabase/TursoConnection
    /// haven't been GC'd (dropped) before reopening at the same path.
    ///
    /// Steps (mirrors the React Native bug report):
    ///   1. Open database A via SDK, create table "cache", close connection
    ///   2. Copy A.db → B.db, delete A.db
    ///   3. Open a *new* database at path A.db — while old db_a/conn_a still alive
    ///   4. CREATE TABLE cache should succeed (A.db is fresh) but fails with
    ///      "table cache already exists" because the registry returned the stale Database
    #[test]
    pub fn test_stale_registry_with_live_sdk_handles() {
        let tmp_dir = tempfile::TempDir::new().unwrap();
        let path_a = tmp_dir.path().join("A.db");
        let path_b = tmp_dir.path().join("B.db");

        // 1. Open database A via SDK and create a table.
        let db_a = TursoDatabase::new(TursoDatabaseConfig {
            path: path_a.to_str().unwrap().to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let _ = db_a.open().unwrap();
        let conn_a = db_a.connect().unwrap();

        let mut stmt = conn_a
            .prepare_single("CREATE TABLE cache(x INTEGER)")
            .unwrap();
        assert_eq!(stmt.execute(None).unwrap().status, TursoStatusCode::Done);
        drop(stmt);

        // Close the connection but do NOT drop conn_a or db_a — simulates
        // the JS GC not having collected them yet.
        conn_a.close().unwrap();

        // 2. Copy A.db → B.db, then delete A.db (and WAL/SHM files).
        std::fs::copy(&path_a, &path_b).unwrap();
        std::fs::remove_file(&path_a).unwrap();
        for ext in &["-wal", "-shm"] {
            let src = tmp_dir.path().join(format!("A.db{ext}"));
            let dst = tmp_dir.path().join(format!("B.db{ext}"));
            if src.exists() {
                std::fs::copy(&src, &dst).unwrap();
                std::fs::remove_file(&src).unwrap();
            }
        }

        // 3. Open a new database at the same path A.db.
        //    The old db_a and conn_a are still alive — this is the key difference
        //    from test_sdk_close_finalizes_leaked_statements which drops everything.
        let db_a2 = TursoDatabase::new(TursoDatabaseConfig {
            path: path_a.to_str().unwrap().to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let _ = db_a2.open().unwrap();
        let conn_a2 = db_a2.connect().unwrap();

        // 4. A.db should be a fresh empty database — CREATE TABLE cache must succeed.
        let mut stmt2 = conn_a2
            .prepare_single("CREATE TABLE cache(x INTEGER)")
            .expect("prepare should succeed on fresh database");
        let result = stmt2.execute(None);
        assert_eq!(
            result.unwrap().status,
            TursoStatusCode::Done,
            "CREATE TABLE cache on a fresh A.db should succeed — \
             stale DATABASE_MANAGER entry returned the old Database"
        );

        // Cleanup: drop old handles (simulates eventual GC).
        drop(conn_a);
        drop(db_a);
    }

    /// Regression test: connection.close() must finalize all outstanding statements
    /// to break the Statement → Arc<Connection> → Arc<Database> chain that keeps the
    /// database alive in DATABASE_MANAGER after a file rename.
    #[test]
    pub fn test_close_finalizes_outstanding_statements() {
        let db = TursoDatabase::new(TursoDatabaseConfig {
            path: ":memory:".to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let result = db.open().unwrap();
        assert!(!result.is_io());

        let conn = db.connect().unwrap();

        // Create a statement but do NOT finalize or drop it
        let mut stmt = conn.prepare_single("SELECT 1").unwrap();
        assert_eq!(stmt.step(None).unwrap(), TursoStatusCode::Row);

        // close() should finalize the outstanding statement
        conn.close().unwrap();

        // The statement should now be finalized — using it returns an error
        let result = stmt.step(None);
        assert!(result.is_err());
        match result.unwrap_err() {
            TursoError::Misuse(msg) => assert_eq!(msg, FINALIZED_ERR),
            other => panic!("expected Misuse error, got: {other:?}"),
        }
    }

    /// Test that finalize() sets the statement handle to None, making subsequent
    /// operations return "statement has been finalized".
    #[test]
    pub fn test_finalize_disposes_statement() {
        let db = TursoDatabase::new(TursoDatabaseConfig {
            path: ":memory:".to_string(),
            experimental_features: None,
            async_io: false,
            encryption: None,
            vfs: None,
            io: None,
            db_file: None,
        });
        let result = db.open().unwrap();
        assert!(!result.is_io());

        let conn = db.connect().unwrap();
        let mut stmt = conn.prepare_single("SELECT 1").unwrap();

        // Finalize the statement
        assert_eq!(stmt.finalize(None).unwrap(), TursoStatusCode::Done);

        // All operations should now return "statement has been finalized"
        assert!(stmt.step(None).is_err());
        assert!(stmt.execute(None).is_err());
        assert!(stmt.reset().is_err());
        assert!(stmt.run_io().is_err());
        assert!(stmt.bind_positional(1, Value::Null).is_err());
        assert_eq!(stmt.n_change(), 0);
        assert_eq!(stmt.column_count(), 0);
        assert_eq!(stmt.parameters_count(), 0);
    }
}
