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

/// How often a bounded wait re-probes the lock. flock(2) has no timed variant,
/// so a bounded wait is a non-blocking probe repeated until the deadline.
#[cfg(not(target_arch = "wasm32"))]
const LOCK_POLL_INTERVAL: Duration = Duration::from_millis(10);

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
///
/// Both blocking calls have a bounded form that reports whether it succeeded
/// instead of waiting on a wedged holder forever:
///
/// if (!(await lock.waitTimeout(30_000))) { ... give up ... }
/// if (!lock.lockTimeout(30_000)) { ... give up ... }

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

    /// Whether anybody holds the lock, the caller itself included.
    ///
    /// The caller's own lock is never disturbed by asking. A lock that is
    /// *free* is briefly taken and released on a file description of the
    /// probe's own, and that hold is real: two processes asking at the same
    /// instant can each be told the lock is held, and a concurrent
    /// `lockTimeout(0)` can fail against nobody. flock has no query operation,
    /// so a take-and-release is the only way to ask.
    #[napi]
    pub fn check(&mut self) -> Result<bool> {
        // The probe needs a description of its own: flock re-locks a
        // description that already holds the lock without complaint, so probing
        // on `self.file` would answer "free" on the holder and release the
        // caller's lock on the way out.
        let probe = open_lock_file(&self.lock_file_path)?;
        let probed = probe.try_lock_exclusive();

        if probed.is_ok() {
            // Probing took the lock on the probe's own description; drop it.
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

    /// Resolves `true` as soon as nobody holds the lock exclusively, `false`
    /// once the timeout has passed with it still held. Nothing is held on
    /// return either way, and `locked` is left as it was: a caller that wants
    /// the current answer asks `check()`, as the graph wait loop does.
    ///
    /// The probe uses its own file description, so a handle that itself holds
    /// the lock waits on nobody but itself and gets `false` at the deadline.
    ///
    /// `timeoutMs` is a count of milliseconds: `Infinity` means `wait()`, with
    /// no deadline at all, and a negative or NaN value is refused. The refusal
    /// is thrown synchronously, before the promise exists, so it cannot be
    /// reached with `.catch()`.
    #[napi(ts_return_type = "Promise<boolean>")]
    pub fn wait_timeout(
        &mut self,
        env: Env,
        timeout_ms: f64,
    ) -> napi::Result<PromiseRaw<'static, bool>> {
        let timeout = timeout_from_ms(timeout_ms)?;
        let lock_file_path = self.lock_file_path.clone();
        let promise = env.spawn_future(async move {
            // The poll sleeps the thread it runs on; keep that off the async
            // workers so a long wait cannot starve other native futures.
            tokio::task::spawn_blocking(move || -> napi::Result<bool> {
                let file = open_lock_file(&lock_file_path)?;
                Ok(wait_until_free(&file, timeout)?)
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

    /// `lock()` that gives up: `true` and the lock is held, `false` once the
    /// timeout has passed without acquiring it. Blocks the calling thread for
    /// at most that long, as `lock()` blocks it indefinitely.
    ///
    /// `timeoutMs` is a count of milliseconds: `0` is a single attempt,
    /// `Infinity` is `lock()` itself, and a negative or NaN value is refused.
    ///
    /// After a `false`, `locked` still reads `true`. The field says whether
    /// anybody holds the lock, not whether this handle does - `false` is
    /// precisely the answer that somebody else does - so `unlock()` after one
    /// would be releasing a lock this handle never took.
    ///
    /// On Windows the lock is `LockFileEx` over the whole range, and an
    /// overlapping request conflicts with a lock the same handle already holds
    /// rather than being granted as flock grants it. So a handle asking for a
    /// lock it already holds gets `true` at once on Unix, while on Windows a
    /// finite budget would poll to the deadline and answer `false` and
    /// `Infinity` - which is `lock()`, the blocking form with no
    /// `LOCKFILE_FAIL_IMMEDIATELY` - would wait on itself. Read out of the
    /// `fs4` source and the Win32 contract, not run there; neither in-tree
    /// caller asks.
    #[napi]
    pub fn lock_timeout(&mut self, timeout_ms: f64) -> napi::Result<bool> {
        let Some(timeout) = timeout_from_ms(timeout_ms)? else {
            // No deadline is what lock() already is, and it blocks in the
            // kernel rather than waking 100 times a second to ask again.
            self.lock()?;
            return Ok(true);
        };
        let acquired = poll_until(timeout, || {
            fs4::fs_std::FileExt::try_lock_exclusive(&self.file)
        })?;
        if acquired {
            self.locked = true;
        }
        Ok(acquired)
    }
}

/// Milliseconds as they arrive from JS, or `None` for "no deadline".
///
/// The parameter is an `f64` rather than a `u32` because napi converts a `u32`
/// through JS `ToUint32`: `Infinity` arrives as 0 and `-1` as 4294967295, so
/// the two spellings a caller reaches for to mean "no limit" and "one below
/// zero" turn into "give up now" and "give up in 49.7 days" - silently, and
/// each the opposite of what was written.
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
    // Float-to-int casts saturate, so an absurd finite value becomes an absurd
    // Duration rather than wrapping to a small one; poll_until then treats a
    // deadline the monotonic clock cannot hold as no deadline.
    Ok(Some(Duration::from_millis(timeout_ms as u64)))
}

/// Opens the file a lock lives on, creating it if needed and never truncating
/// it: the file carries no content, only the flock state of its descriptions.
#[cfg(not(target_arch = "wasm32"))]
fn open_lock_file(path: &str) -> std::io::Result<fs::File> {
    OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(path)
}

/// Repeats a non-blocking lock attempt until it succeeds or `timeout` passes.
/// Contention is the only error that is retried; anything else propagates.
#[cfg(not(target_arch = "wasm32"))]
fn poll_until<F>(timeout: Duration, mut attempt: F) -> std::io::Result<bool>
where
    F: FnMut() -> std::io::Result<()>,
{
    // A timeout large enough to overflow the monotonic clock leaves no
    // deadline to compare against, and at that scale there is nothing to
    // distinguish it from an unbounded wait anyway.
    let deadline = Instant::now().checked_add(timeout);
    let contended = fs4::lock_contended_error().raw_os_error();
    loop {
        match attempt() {
            Ok(()) => return Ok(true),
            Err(e) if e.raw_os_error() == contended => {}
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

/// The blocking half of `wait_timeout`: a shared probe on `file`, released at
/// once when it succeeds. A deadline makes it a non-blocking probe retried
/// until that deadline; `None` blocks in the kernel, which is what `wait()`
/// does and is cheaper than waking to ask.
///
/// `file` must be a description of its own, not the handle's. On Unix a shared
/// probe on a description that already holds the exclusive lock is granted at
/// once - flock downgrades it - and on Windows `LockFileEx` would refuse or
/// block instead. Neither answers the question that was asked.
#[cfg(not(target_arch = "wasm32"))]
fn wait_until_free(file: &fs::File, timeout: Option<Duration>) -> std::io::Result<bool> {
    let Some(timeout) = timeout else {
        fs4::fs_std::FileExt::lock_shared(file)?;
        fs4::fs_std::FileExt::unlock(file)?;
        return Ok(true);
    };
    let free = poll_until(timeout, || fs4::fs_std::FileExt::try_lock_shared(file))?;
    if free {
        fs4::fs_std::FileExt::unlock(file)?;
    }
    Ok(free)
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
        // Zero is the only try-lock this API offers: one attempt, no waiting.
        // Testing the deadline before the first attempt would make it a call
        // that can never succeed, and every other case here has a budget large
        // enough to hide that.
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
        // A u32 parameter would arrive through JS ToUint32, turning -1 into
        // 4294967295 - a 49.7-day block - and NaN into 0. Refusing here is
        // what keeps either from looking like a deliberate budget.
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);
        let mut a = FileLock::new(path).unwrap();

        assert!(a.lock_timeout(-1.0).is_err());
        assert!(a.lock_timeout(f64::NAN).is_err());
        assert!(!a.locked, "a refused call must not have taken the lock");
    }

    #[test]
    fn an_infinite_timeout_waits_rather_than_giving_up_at_once() {
        // The other half of the same trap: ToUint32 turns Infinity into 0, so
        // `lockTimeout(opts.timeout ?? Infinity)` would fail instantly. The
        // lock has to be held for that to be visible - against a free one a
        // zero budget succeeds too.
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
    fn wait_until_free_without_a_deadline_returns_once_the_holder_releases() {
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        a.lock().unwrap();

        let release = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(50));
            a.unlock().unwrap();
        });

        let probe = open_lock_file(&path).unwrap();
        let start = Instant::now();
        assert!(wait_until_free(&probe, None).unwrap());
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
    fn poll_until_propagates_errors_other_than_contention() {
        let start = Instant::now();
        let result = poll_until(Duration::from_millis(200), || {
            Err(std::io::Error::other("not a lock conflict"))
        });
        assert!(
            result.is_err(),
            "a non-contention error must not be retried"
        );
        assert!(
            start.elapsed() < Duration::from_millis(200),
            "the error was retried until the deadline instead of propagated"
        );
    }

    #[test]
    fn wait_until_free_gives_up_while_held_and_returns_once_released() {
        let tmp_dir = TempDir::new().unwrap();
        let path = lock_path(&tmp_dir);

        let mut a = FileLock::new(path.clone()).unwrap();
        a.lock().unwrap();

        let probe = open_lock_file(&path).unwrap();
        let start = Instant::now();
        assert!(!wait_until_free(&probe, Some(Duration::from_millis(100))).unwrap());
        let elapsed = start.elapsed();
        assert!(
            elapsed >= Duration::from_millis(100),
            "gave up after {elapsed:?}, before the 100ms budget"
        );
        assert!(elapsed < Duration::from_secs(5), "waited {elapsed:?}");

        a.unlock().unwrap();
        assert!(wait_until_free(&probe, Some(Duration::from_secs(1))).unwrap());

        // The successful probe must leave nothing held behind.
        assert!(!FileLock::new(path).unwrap().locked);
    }
}
