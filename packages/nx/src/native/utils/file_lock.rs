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

/// Set for pickup latency, not for cost. A waiter notices a release within one
/// interval, and what it waits for is a plugin load or a workspace walk, so the
/// interval is the whole of the lag a caller can see.
///
/// Cost is small but not as small as the syscall alone suggests, because the
/// timer wake dominates it: measured with eleven waiters on one held lock, 4ms
/// costs 0.31% of a core per waiting process and 3.4% in aggregate, against
/// 0.057% and 0.62% at 25ms. Measured on a fourteen-core macOS box; the ratio
/// holds elsewhere, the absolute percentages will not.
#[cfg(not(target_arch = "wasm32"))]
const LOCK_POLL_INTERVAL: Duration = Duration::from_millis(4);

/// The lock file, created if it is not there yet.
///
/// Never truncated: the lock is on the file rather than on anything written in
/// it, and a holder's own handle would be the one losing its contents.
#[cfg(not(target_arch = "wasm32"))]
fn open_lock_file(lock_file_path: &str) -> std::io::Result<fs::File> {
    OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(lock_file_path)
}

/// Whether the lock on `lock_file_path` was released within `timeout`.
///
/// Takes a shared lock and drops it again, so the caller learns that the holder
/// is gone without becoming one. Polled rather than blocking outright, so a
/// holder that never returns cannot hold the caller forever.
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
        // Never past the deadline, so the caller's ceiling is the ceiling rather
        // than the ceiling plus one interval.
        std::thread::sleep(LOCK_POLL_INTERVAL.min(remaining));
    }
}

/// Contention reports as `WouldBlock` on some platforms and as the raw OS error
/// on others, and neither means the lock file is unusable.
#[cfg(not(target_arch = "wasm32"))]
fn is_contended(e: &std::io::Error) -> bool {
    e.kind() == std::io::ErrorKind::WouldBlock
        || e.raw_os_error() == fs4::lock_contended_error().raw_os_error()
}

/// Waits for whoever holds a lock to release it, on a libuv thread rather than
/// the JS one, so awaiting it leaves the event loop free to run timers, service
/// sockets and handle signals.
#[cfg(not(target_arch = "wasm32"))]
pub struct WaitForRelease {
    lock_file_path: String,
    timeout: Duration,
}

#[cfg(not(target_arch = "wasm32"))]
impl Task for WaitForRelease {
    type Output = bool;
    type JsValue = bool;

    fn compute(&mut self) -> napi::Result<bool> {
        Ok(wait_for_release(&self.lock_file_path, self.timeout)?)
    }

    fn resolve(&mut self, _env: Env, output: bool) -> napi::Result<bool> {
        Ok(output)
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
///   await lock.waitForRelease(timeoutMs)
///   readFromCache()
/// }
///
/// `lock()` is the same acquire, blocking the JS thread until it succeeds, and
/// `wait()` the same wait, with no ceiling.

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

    /// Waits for the holder to release, with no ceiling of its own.
    ///
    /// Gated on `locked`, so a caller that has not had `check` or `try_lock` set
    /// it gets a promise that resolves at once while the file is still held. That
    /// mutation is load-bearing rather than bookkeeping: removing it turns this
    /// into an immediate resolve and any loop around it into a hot spin.
    #[napi(ts_return_type = "Promise<void>")]
    pub fn wait(&mut self, env: Env) -> napi::Result<PromiseRaw<'static, ()>> {
        if self.locked {
            let lock_file_path = self.lock_file_path.clone();
            self.locked = false;
            let promise = env.spawn_future(async move {
                let file = open_lock_file(&lock_file_path)?;
                fs4::fs_std::FileExt::lock_shared(&file)?;
                fs4::fs_std::FileExt::unlock(&file)?;
                Ok(())
            })?;
            // SAFETY: PromiseRaw's inner napi_value is GC-managed by V8
            // and remains valid beyond this stack frame.
            Ok(unsafe { std::mem::transmute(promise) })
        } else {
            let promise = env.spawn_future(async move { Ok(()) })?;
            Ok(unsafe { std::mem::transmute(promise) })
        }
    }

    /// Takes the lock and keeps it, reporting whether this handle got it.
    ///
    /// Unlike `check`, which releases whatever it took, and unlike `lock`, which
    /// blocks the calling thread until the holder releases. Blocking matters on
    /// the JS side: `lock` is synchronous, so a process that loses a race for the
    /// lock freezes its own event loop until the winner is done.
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

    /// From JS, pair this with `waitForRelease` rather than with `wait`. A failed
    /// `tryLock` leaves `locked` set, which is what `wait` keys off, so waiting
    /// that way has no ceiling.
    #[napi(js_name = "tryLock")]
    pub fn try_lock_js(&mut self) -> napi::Result<bool> {
        Ok(self.try_lock()?)
    }

    /// Resolves true when the holder released within `timeout_ms`, false when it
    /// did not. Awaiting this does not block the JS thread.
    #[napi(ts_return_type = "Promise<boolean>")]
    pub fn wait_for_release(&self, timeout_ms: u32) -> AsyncTask<WaitForRelease> {
        AsyncTask::new(WaitForRelease {
            lock_file_path: self.lock_file_path.clone(),
            timeout: Duration::from_millis(timeout_ms as u64),
        })
    }

    #[napi]
    pub fn lock(&mut self) -> napi::Result<()> {
        self.file.lock_exclusive()?;
        self.locked = true;
        Ok(())
    }

    /// Blocks the calling thread until the current holder releases or `timeout`
    /// passes, and says which. For Rust callers without a napi `Env`; from JS,
    /// `wait_for_release` is the same wait without blocking the thread.
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
        // Near the deadline rather than an order of magnitude past it. What keeps
        // it exact is the sleep being capped by the remaining budget; a
        // wall-clock bound tight enough to pin a 4ms overshoot would flake.
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
