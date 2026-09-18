#[cfg(not(target_arch = "wasm32"))]
use napi::bindgen_prelude::*;
use std::fs;
#[cfg(not(target_arch = "wasm32"))]
use std::{
    fs::OpenOptions,
    path::Path,
    time::{Duration, Instant},
};
#[cfg(not(target_arch = "wasm32"))]
use tracing::trace;

#[cfg(not(target_arch = "wasm32"))]
use fs4::fs_std::FileExt;

/// How late a waiter can notice a release. Each poll costs a timer wake, so don't go much lower.
#[cfg(not(target_arch = "wasm32"))]
const LOCK_POLL_INTERVAL: Duration = Duration::from_millis(4);

#[cfg(not(target_arch = "wasm32"))]
fn open_lock_file(lock_file_path: &str) -> std::io::Result<fs::File> {
    OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(lock_file_path)
}

/// Polls a shared lock, so the caller learns the holder is gone without becoming one.
#[cfg(not(target_arch = "wasm32"))]
fn wait_for_release(lock_file_path: &str, timeout: Duration) -> std::io::Result<bool> {
    let file = open_lock_file(lock_file_path)?;
    let deadline = Instant::now() + timeout;
    loop {
        match fs4::fs_std::FileExt::try_lock_shared(&file) {
            Ok(()) => {
                fs4::fs_std::FileExt::unlock(&file)?;
                return Ok(true);
            }
            Err(e) if is_contended(&e) => {}
            Err(e) => return Err(e),
        }
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Ok(false);
        }
        std::thread::sleep(LOCK_POLL_INTERVAL.min(remaining));
    }
}

/// Contention is `WouldBlock` on some platforms and a raw OS error on others.
#[cfg(not(target_arch = "wasm32"))]
fn is_contended(e: &std::io::Error) -> bool {
    e.kind() == std::io::ErrorKind::WouldBlock
        || e.raw_os_error() == fs4::lock_contended_error().raw_os_error()
}

/// Sleeps on the async runtime, not a libuv worker: this wait can last minutes
/// and there are only four workers by default.
#[cfg(not(target_arch = "wasm32"))]
async fn wait_for_release_async(lock_file_path: String) -> std::io::Result<()> {
    let file = open_lock_file(&lock_file_path)?;
    loop {
        match fs4::fs_std::FileExt::try_lock_shared(&file) {
            Ok(()) => {
                fs4::fs_std::FileExt::unlock(&file)?;
                return Ok(());
            }
            Err(e) if is_contended(&e) => {}
            Err(e) => return Err(e),
        }
        tokio::time::sleep(LOCK_POLL_INTERVAL).await;
    }
}

#[napi]
#[cfg_attr(target_arch = "wasm32", allow(dead_code))]
pub struct FileLock {
    #[napi]
    pub locked: bool,
    file: fs::File,
    lock_file_path: String,
}

/// const lock = new FileLock('lockfile.lock');
/// if (lock.tryLock()) {
///   ... do some work
///   writeToCache()
///   lock.unlock()
/// } else {
///   await lock.waitUntilFree()
///   readFromCache()
/// }

#[napi]
#[cfg(not(target_arch = "wasm32"))]
impl FileLock {
    #[napi(constructor)]
    pub fn new(lock_file_path: String) -> anyhow::Result<Self> {
        // Creates the directory where the lock file will be stored
        fs::create_dir_all(Path::new(&lock_file_path).parent().unwrap())?;

        let file = open_lock_file(&lock_file_path)?;

        trace!("Locking file {}", lock_file_path);

        // Check if the file is locked
        let file_lock: std::result::Result<(), std::io::Error> = file.try_lock_exclusive();

        if file_lock.is_ok() {
            // Checking if the file is locked, locks it, so unlock it.
            fs4::fs_std::FileExt::unlock(&file)?;
        }

        Ok(Self {
            file,
            locked: file_lock.is_err(),
            lock_file_path,
        })
    }

    #[napi]
    pub fn unlock(&mut self) -> Result<()> {
        fs4::fs_std::FileExt::unlock(&self.file)?;
        self.locked = false;
        Ok(())
    }

    #[napi]
    pub fn check(&mut self) -> Result<bool> {
        // Check if the file is locked
        let file_lock: std::result::Result<(), std::io::Error> = self.file.try_lock_exclusive();

        if file_lock.is_ok() {
            // Checking if the file is locked, locks it, so unlock it.
            fs4::fs_std::FileExt::unlock(&self.file)?;
        }

        self.locked = file_lock.is_err();
        Ok(self.locked)
    }

    /// Takes the lock without blocking; false means another handle holds it.
    pub fn try_lock(&mut self) -> std::io::Result<bool> {
        match self.file.try_lock_exclusive() {
            Ok(()) => {
                self.locked = true;
                Ok(true)
            }
            Err(e) if is_contended(&e) => {
                // Held by someone, which is what `locked` records. The return
                // value is what says whether this handle is that someone.
                self.locked = true;
                Ok(false)
            }
            Err(e) => Err(e),
        }
    }

    /// Takes the lock without blocking; false means another handle holds it.
    /// Wait with `waitUntilFree`, not `lock`, which blocks the event loop.
    #[napi(js_name = "tryLock")]
    pub fn try_lock_js(&mut self) -> napi::Result<bool> {
        Ok(self.try_lock()?)
    }

    /// Resolves once the lock is free, without taking it; follow with `tryLock`.
    #[napi(ts_return_type = "Promise<void>")]
    pub fn wait_until_free(&self, env: Env) -> napi::Result<PromiseRaw<'static, ()>> {
        let lock_file_path = self.lock_file_path.clone();
        let promise =
            env.spawn_future(async move { Ok(wait_for_release_async(lock_file_path).await?) })?;
        // SAFETY: PromiseRaw's inner napi_value is GC-managed by V8 and remains
        // valid beyond this stack frame.
        Ok(unsafe { std::mem::transmute(promise) })
    }

    #[napi]
    pub fn lock(&mut self) -> napi::Result<()> {
        self.file.lock_exclusive()?;
        self.locked = true;
        Ok(())
    }

    /// Blocks the calling thread until the holder releases or `timeout` passes; true if released.
    pub fn wait_blocking(&self, timeout: Duration) -> std::io::Result<bool> {
        wait_for_release(&self.lock_file_path, timeout)
    }
}

#[napi]
#[cfg(target_arch = "wasm32")]
impl FileLock {
    #[napi(constructor)]
    pub fn new(_lock_file_path: String) -> anyhow::Result<Self> {
        anyhow::bail!("FileLock is not supported on WASM")
    }
}

// TODO: Fix the tests
#[cfg(test)]
mod test {
    use super::*;

    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    #[test]
    fn test_new_lock() {
        let tmp_dir = TempDir::new().unwrap();
        let lock_file = tmp_dir.child("test_lock_file");
        let lock_file_path = lock_file.path().to_path_buf();
        let lock_file_path_str = lock_file_path.into_os_string().into_string().unwrap();
        let mut file_lock = FileLock::new(lock_file_path_str).unwrap();
        assert_eq!(file_lock.locked, false);
        let _ = file_lock.lock();
        assert_eq!(file_lock.locked, true);
        assert!(lock_file.exists());
        let _ = file_lock.unlock();
        assert_eq!(file_lock.locked, false);
    }

    #[test]
    fn wait_blocking_returns_true_once_the_holder_releases() {
        let tmp_dir = TempDir::new().unwrap();
        let path = tmp_dir.child("lock").path().to_string_lossy().to_string();
        let mut holder = FileLock::new(path.clone()).unwrap();
        holder.lock().unwrap();
        let (waiting, on_waiting) = std::sync::mpsc::channel();
        let waiter = std::thread::spawn(move || {
            let lock = FileLock::new(path).unwrap();
            let started = Instant::now();
            waiting.send(()).unwrap();
            let released = lock.wait_blocking(Duration::from_secs(10)).unwrap();
            (released, started.elapsed())
        });
        // Release only once the waiter is about to block, so the elapsed
        // check below cannot pass on a waiter that never blocked.
        on_waiting.recv().unwrap();
        std::thread::sleep(Duration::from_millis(100));
        holder.unlock().unwrap();
        let (released, waited) = waiter.join().unwrap();
        assert!(released);
        // It really blocked on the holder rather than getting the lock at once.
        assert!(waited >= Duration::from_millis(100));
    }

    #[test]
    fn wait_blocking_returns_false_when_the_holder_outlasts_the_timeout() {
        let tmp_dir = TempDir::new().unwrap();
        let path = tmp_dir.child("lock").path().to_string_lossy().to_string();
        let mut holder = FileLock::new(path.clone()).unwrap();
        holder.lock().unwrap();
        let started = Instant::now();
        let released = FileLock::new(path.clone())
            .unwrap()
            .wait_blocking(Duration::from_millis(200))
            .unwrap();
        assert!(!released);
        let waited = started.elapsed();
        assert!(waited >= Duration::from_millis(200));
        // Pins the sleep being capped by the remaining budget.
        assert!(waited < Duration::from_millis(400), "waited {waited:?}");
        // Seen from a fresh handle; `check` on the holder's own handle would
        // release it, since the lock is held by that handle.
        assert!(FileLock::new(path).unwrap().locked);
        drop(holder);
    }

    #[test]
    fn test_drop() {
        let tmp_dir = TempDir::new().unwrap();
        let lock_file = tmp_dir.child("test_lock_file");
        let lock_file_path = lock_file.path().to_path_buf();
        let lock_file_path_str = lock_file_path.into_os_string().into_string().unwrap();
        {
            let mut file_lock = FileLock::new(lock_file_path_str.clone()).unwrap();
            let _ = file_lock.lock();
        }
        let file_lock = FileLock::new(lock_file_path_str.clone());
        assert_eq!(file_lock.unwrap().locked, false);
    }
}
