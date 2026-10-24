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

#[cfg(not(target_arch = "wasm32"))]
const LOCK_POLL_INTERVAL: Duration = Duration::from_millis(25);

#[napi]
#[cfg_attr(target_arch = "wasm32", allow(dead_code))]
pub struct FileLock {
    #[napi]
    pub locked: bool,
    file: fs::File,
    lock_file_path: String,
}

/// const lock = new FileLock('lockfile.lock');
/// if (lock.locked) {
///   lock.wait()
///   readFromCache()
/// } else {
///  lock.lock()
///  ... do some work
///  writeToCache()
///  lock.unlock()
/// }

#[napi]
#[cfg(not(target_arch = "wasm32"))]
impl FileLock {
    #[napi(constructor)]
    pub fn new(lock_file_path: String) -> anyhow::Result<Self> {
        // Creates the directory where the lock file will be stored
        fs::create_dir_all(Path::new(&lock_file_path).parent().unwrap())?;

        // Opens the lock file
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

    /// Whether anybody holds the lock, the caller included. A free lock is
    /// briefly taken and released to answer.
    #[napi]
    pub fn check(&mut self) -> Result<bool> {
        // Own description: flock re-locks one that already holds the lock, and
        // the unlock below would then release the caller's.
        let probe = open_lock_file(&self.lock_file_path)?;
        let probed = probe.try_lock_exclusive();

        if probed.is_ok() {
            // Checking if the file is locked, locks it, so unlock it.
            fs4::fs_std::FileExt::unlock(&probe)?;
        }

        self.locked = probed.is_err();
        Ok(self.locked)
    }

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

    /// Resolves `true` once nobody holds the lock, `false` if `timeoutMs` passes
    /// first. `Infinity` is `wait()`; negative or NaN throws synchronously.
    /// Leaves `locked` as it was.
    #[napi(ts_return_type = "Promise<boolean>")]
    pub fn wait_timeout(
        &mut self,
        env: Env,
        timeout_ms: f64,
    ) -> napi::Result<PromiseRaw<'static, bool>> {
        let timeout = timeout_from_ms(timeout_ms)?;
        let lock_file_path = self.lock_file_path.clone();
        let promise = env.spawn_future(async move {
            // The poll sleeps its thread, so keep it off the async workers.
            tokio::task::spawn_blocking(move || -> napi::Result<bool> {
                Ok(wait_for_release(&lock_file_path, timeout)?)
            })
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))?
        })?;
        // SAFETY: PromiseRaw's inner napi_value is GC-managed by V8
        // and remains valid beyond this stack frame.
        Ok(unsafe {
            std::mem::transmute::<PromiseRaw<'_, bool>, PromiseRaw<'static, bool>>(promise)
        })
    }

    #[napi]
    pub fn lock(&mut self) -> napi::Result<()> {
        self.file.lock_exclusive()?;
        self.locked = true;
        Ok(())
    }

    /// `lock()` that gives up: `false` if the lock is still held after
    /// `timeoutMs`. `0` is a single attempt and `Infinity` is `lock()`;
    /// negative or NaN throws. As with `tryLock()`, `false` leaves `locked` true.
    #[napi]
    pub fn lock_timeout(&mut self, timeout_ms: f64) -> napi::Result<bool> {
        let deadline = timeout_from_ms(timeout_ms)?.and_then(deadline_after);
        let Some(deadline) = deadline else {
            // Unbounded: lock() blocks in the kernel instead of polling.
            self.lock()?;
            return Ok(true);
        };
        loop {
            if self.try_lock()? {
                return Ok(true);
            }
            let now = Instant::now();
            if now >= deadline {
                return Ok(false);
            }
            std::thread::sleep(LOCK_POLL_INTERVAL.min(deadline - now));
        }
    }

    /// Takes the lock if nobody holds it, without blocking. On contention it
    /// still sets `locked`, so a following `wait()` waits.
    pub fn try_lock(&mut self) -> std::io::Result<bool> {
        match self.file.try_lock_exclusive() {
            Ok(()) => {
                self.locked = true;
                Ok(true)
            }
            Err(e)
                if e.kind() == std::io::ErrorKind::WouldBlock
                    || e.raw_os_error() == fs4::lock_contended_error().raw_os_error() =>
            {
                self.locked = true;
                Ok(false)
            }
            Err(e) => Err(e),
        }
    }

    /// Takes the lock without blocking; false means another handle holds it.
    #[napi(js_name = "tryLock")]
    pub fn try_lock_js(&mut self) -> napi::Result<bool> {
        Ok(self.try_lock()?)
    }

    /// Blocks the calling thread until the current holder releases or
    /// `timeout` passes, and says which. The same shared-then-release dance as
    /// `wait`, for callers without a napi `Env`, polled so that a holder that
    /// never returns (suspended, or on a filesystem that has stalled) cannot
    /// hold the caller forever.
    pub fn wait_blocking(&self, timeout: Duration) -> std::io::Result<bool> {
        wait_for_release(&self.lock_file_path, Some(timeout))
    }
}

/// `None` for no deadline. The parameter is an `f64`, not a `u32`: napi converts
/// a `u32` through `ToUint32`, so `Infinity` arrives as 0 and `-1` as 4294967295.
#[cfg(not(target_arch = "wasm32"))]
fn timeout_from_ms(timeout_ms: f64) -> napi::Result<Option<Duration>> {
    if timeout_ms.is_nan() || timeout_ms < 0.0 {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("timeoutMs must be a non-negative number of milliseconds, got {timeout_ms}"),
        ));
    }
    if timeout_ms.is_infinite() {
        return Ok(None);
    }
    Ok(Some(Duration::from_millis(timeout_ms as u64)))
}

/// `None` when the clock cannot hold the instant, which is as good as no deadline.
#[cfg(not(target_arch = "wasm32"))]
fn deadline_after(timeout: Duration) -> Option<Instant> {
    Instant::now().checked_add(timeout)
}

/// The file holds no content, only flock state, so it is never truncated.
#[cfg(not(target_arch = "wasm32"))]
fn open_lock_file(path: &str) -> std::io::Result<fs::File> {
    OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(path)
}

/// Waits until the exclusive lock is free, or `timeout` passes; `None` has no
/// deadline. Probes on a description of its own: flock grants a shared lock to
/// a description that already holds the exclusive one.
#[cfg(not(target_arch = "wasm32"))]
fn wait_for_release(lock_file_path: &str, timeout: Option<Duration>) -> std::io::Result<bool> {
    let file = open_lock_file(lock_file_path)?;
    let Some(timeout) = timeout else {
        fs4::fs_std::FileExt::lock_shared(&file)?;
        fs4::fs_std::FileExt::unlock(&file)?;
        return Ok(true);
    };
    let deadline = deadline_after(timeout);
    loop {
        match fs4::fs_std::FileExt::try_lock_shared(&file) {
            Ok(()) => {
                fs4::fs_std::FileExt::unlock(&file)?;
                return Ok(true);
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
            Err(e) if e.raw_os_error() == fs4::lock_contended_error().raw_os_error() => {}
            Err(e) => return Err(e),
        }
        let now = Instant::now();
        match deadline {
            Some(deadline) if now >= deadline => return Ok(false),
            Some(deadline) => std::thread::sleep(LOCK_POLL_INTERVAL.min(deadline - now)),
            None => std::thread::sleep(LOCK_POLL_INTERVAL),
        }
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

#[cfg(test)]
mod test {
    use super::*;

    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    fn lock_path(tmp_dir: &TempDir) -> String {
        tmp_dir
            .child("test_lock_file")
            .path()
            .to_path_buf()
            .into_os_string()
            .into_string()
            .unwrap()
    }

    #[test]
    fn test_new_lock() {
        let tmp_dir = TempDir::new().unwrap();
        let lock_file = tmp_dir.child("test_lock_file");
        let mut file_lock = FileLock::new(lock_path(&tmp_dir)).unwrap();
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
        assert!(started.elapsed() >= Duration::from_millis(200));
        // Seen from a fresh handle.
        assert!(FileLock::new(path).unwrap().locked);
        drop(holder);
    }

    #[test]
    fn test_drop() {
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);
        {
            let mut file_lock = FileLock::new(path.clone()).unwrap();
            let _ = file_lock.lock();
        }
        assert_eq!(FileLock::new(path).unwrap().locked, false);
    }

    // flock is per open file description, so a second handle in this process
    // is excluded exactly like another process would be. That is what lets
    // every test here run without a subprocess.
    #[test]
    fn a_second_handle_is_excluded_while_the_first_holds() {
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        a.lock().unwrap();

        let mut b = FileLock::new(path.clone()).unwrap();
        assert!(b.locked, "constructor probe must see a's lock");
        assert!(
            b.check().unwrap(),
            "check from a non-holder must see a's lock"
        );

        a.unlock().unwrap();
        assert!(!b.check().unwrap(), "a's unlock must free the file for b");
    }

    #[test]
    fn check_on_the_holder_reports_locked_and_keeps_the_lock() {
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        a.lock().unwrap();

        assert!(
            a.check().unwrap(),
            "the holder must be told the file is locked"
        );
        assert!(a.locked);

        // The lock must survive the question: a fresh description is still
        // excluded, which it would not be if check() had probed on a's own
        // description and unlocked it.
        let mut b = FileLock::new(path.clone()).unwrap();
        assert!(b.locked, "check() on the holder must not release the lock");
        assert!(!b.lock_timeout(50.0).unwrap());

        a.unlock().unwrap();
        assert!(!b.check().unwrap());
    }

    #[test]
    fn check_follows_whoever_holds_the_lock() {
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        let mut b = FileLock::new(path.clone()).unwrap();

        a.lock().unwrap();
        a.unlock().unwrap();

        // a no longer holds it, so a's check() must report what others do.
        assert!(!a.check().unwrap());
        b.lock().unwrap();
        assert!(a.check().unwrap());
        b.unlock().unwrap();
        assert!(!a.check().unwrap());
    }

    #[test]
    fn lock_timeout_acquires_a_free_lock_and_holds_it() {
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        assert!(a.lock_timeout(1_000.0).unwrap());
        assert!(a.locked);

        let b = FileLock::new(path.clone()).unwrap();
        assert!(b.locked, "lock_timeout must actually take the lock");

        a.unlock().unwrap();
        assert!(!FileLock::new(path).unwrap().locked);
    }

    #[test]
    fn lock_timeout_gives_up_after_the_budget_while_held() {
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        a.lock().unwrap();
        let mut b = FileLock::new(path.clone()).unwrap();

        let start = Instant::now();
        assert!(!b.lock_timeout(100.0).unwrap());
        let elapsed = start.elapsed();
        assert!(
            elapsed >= Duration::from_millis(100),
            "gave up after {elapsed:?}, before the 100ms budget"
        );
        assert!(elapsed < Duration::from_secs(5), "waited {elapsed:?}");

        a.unlock().unwrap();
        assert!(b.lock_timeout(1_000.0).unwrap());
        b.unlock().unwrap();
    }

    #[test]
    fn lock_timeout_acquires_once_the_holder_releases_mid_wait() {
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        a.lock().unwrap();
        let mut b = FileLock::new(path.clone()).unwrap();

        let release = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(50));
            a.unlock().unwrap();
        });

        let start = Instant::now();
        assert!(b.lock_timeout(5_000.0).unwrap());
        let elapsed = start.elapsed();
        release.join().unwrap();
        assert!(
            elapsed >= Duration::from_millis(50),
            "acquired after {elapsed:?}, while a still held the lock"
        );
        assert!(
            elapsed < Duration::from_secs(5),
            "took the whole budget ({elapsed:?}) although the lock was released early"
        );
        assert!(b.locked);
        b.unlock().unwrap();
    }

    #[test]
    fn lock_timeout_that_gives_up_leaves_locked_reading_true() {
        // The doc promises it, and the handle is built while the lock is free,
        // so nothing but the give-up itself can have set the field.
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut b = FileLock::new(path.clone()).unwrap();
        assert!(!b.locked);

        let mut a = FileLock::new(path).unwrap();
        a.lock().unwrap();

        assert!(!b.lock_timeout(50.0).unwrap());
        assert!(
            b.locked,
            "false means somebody holds it, and locked says so"
        );
    }

    #[test]
    fn check_refreshes_the_cached_locked_flag() {
        // wait() branches on the field rather than on a fresh probe, so an
        // answer check() does not write back is an answer nothing acts on.
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        a.lock().unwrap();

        let mut b = FileLock::new(path.clone()).unwrap();
        assert!(b.locked, "constructor probe must see a's lock");

        a.unlock().unwrap();
        assert!(!b.check().unwrap());
        assert!(!b.locked, "check() must write back the answer it gave");

        a.lock().unwrap();
        assert!(b.check().unwrap());
        assert!(b.locked, "check() must write back the answer it gave");
    }

    #[test]
    fn lock_timeout_with_a_zero_budget_still_attempts_once() {
        // A deadline tested before the first attempt would make zero never succeed.
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        assert!(
            a.lock_timeout(0.0).unwrap(),
            "a zero budget must still make one attempt"
        );
        assert!(a.locked);

        let mut b = FileLock::new(path).unwrap();
        assert!(
            !b.lock_timeout(0.0).unwrap(),
            "and must report failure rather than wait when it is held"
        );
    }

    #[test]
    fn a_timeout_that_is_not_a_count_of_milliseconds_is_refused() {
        // A u32 parameter would turn -1 into 4294967295 and NaN into 0.
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);
        let mut a = FileLock::new(path).unwrap();

        assert!(a.lock_timeout(-1.0).is_err());
        assert!(a.lock_timeout(f64::NAN).is_err());
        assert!(!a.locked, "a refused call must not have taken the lock");
    }

    #[test]
    fn an_infinite_timeout_waits_rather_than_giving_up_at_once() {
        // A u32 parameter would turn Infinity into 0; against a free lock that
        // would still succeed, so the lock is held.
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        a.lock().unwrap();
        let mut b = FileLock::new(path.clone()).unwrap();

        let release = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(100));
            a.unlock().unwrap();
        });

        let start = Instant::now();
        assert!(b.lock_timeout(f64::INFINITY).unwrap());
        let elapsed = start.elapsed();
        release.join().unwrap();
        assert!(
            elapsed >= Duration::from_millis(100),
            "gave up after {elapsed:?} instead of waiting out the holder"
        );
        assert!(b.locked);
    }

    #[test]
    fn an_absurdly_large_finite_timeout_is_not_a_deadline() {
        // Saturates to a Duration that must take the unbounded path.
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        assert!(a.lock_timeout(f64::MAX).unwrap());
        assert!(a.locked);
        assert!(FileLock::new(path).unwrap().locked);
    }

    #[test]
    fn a_budget_no_clock_can_hold_has_no_deadline() {
        // f64::MAX ms still fits an Instant on Unix; only a Duration built directly overflows.
        assert!(deadline_after(Duration::MAX).is_none());
        assert!(deadline_after(Duration::from_secs(1)).is_some());
    }

    #[test]
    fn wait_for_release_treats_a_budget_no_clock_can_hold_as_unbounded() {
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);
        assert!(wait_for_release(&path, Some(Duration::MAX)).unwrap());
    }

    #[test]
    fn wait_for_release_without_a_deadline_returns_once_the_holder_releases() {
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        a.lock().unwrap();

        let release = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(50));
            a.unlock().unwrap();
        });

        let start = Instant::now();
        assert!(wait_for_release(&path, None).unwrap());
        let elapsed = start.elapsed();
        release.join().unwrap();
        assert!(
            elapsed >= Duration::from_millis(50),
            "returned after {elapsed:?}, while a still held the lock"
        );

        // The successful probe must leave nothing held behind, deadline or not.
        assert!(!FileLock::new(path).unwrap().locked);
    }

    #[test]
    fn wait_for_release_gives_up_while_held_and_returns_once_released() {
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        a.lock().unwrap();

        let start = Instant::now();
        assert!(!wait_for_release(&path, Some(Duration::from_millis(100))).unwrap());
        let elapsed = start.elapsed();
        assert!(
            elapsed >= Duration::from_millis(100),
            "gave up after {elapsed:?}, before the 100ms budget"
        );
        assert!(elapsed < Duration::from_secs(5), "waited {elapsed:?}");

        a.unlock().unwrap();
        assert!(wait_for_release(&path, Some(Duration::from_secs(1))).unwrap());

        // The successful probe must leave nothing held behind.
        assert!(!FileLock::new(path).unwrap().locked);
    }

    #[test]
    fn wait_for_release_on_the_holders_own_lock_waits_on_nobody_but_itself() {
        // The probe has its own description, so the holder is not waved through.
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        a.lock().unwrap();

        assert!(!wait_for_release(&path, Some(Duration::from_millis(50))).unwrap());
        assert!(
            FileLock::new(path).unwrap().locked,
            "and must not release it"
        );
    }
}
