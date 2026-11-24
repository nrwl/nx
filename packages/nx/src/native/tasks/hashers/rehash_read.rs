use std::fs::File;
use std::io::{ErrorKind, Read};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use anyhow::{Result, ensure};

const BUDGET_EXCEEDED: &str =
    "NX_REHASH_MEMORY_BUDGET: settled file reads exceed the supplied byte budget";

/// The caller may bound the page cache touched by live reads. Charge each
/// distinct file before reading its bytes, rounded up to a whole OS page.
#[derive(Default)]
pub(crate) struct RehashReadBudget {
    remaining: Option<AtomicU64>,
}

impl RehashReadBudget {
    /// Return unused pages of Nx's native allocator between a budgeted batch's
    /// planning, disk hashing and JS finalization. Its normal decay interval
    /// can keep all three phases' scratch memory resident for the entire run.
    pub(crate) fn release_unused_pages(&self) {
        #[cfg(any(target_os = "linux", target_os = "macos"))]
        if self.remaining.is_some() {
            // jemalloc's MALLCTL_ARENAS_ALL is 4096. This write-only command
            // takes no arguments and only releases unused allocator pages.
            unsafe {
                tikv_jemalloc_sys::mallctl(
                    c"arena.4096.purge".as_ptr(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    0,
                );
            }
        }
    }

    pub(crate) fn new(bytes: Option<f64>) -> Result<Self> {
        let remaining = match bytes {
            None => None,
            Some(n) => {
                ensure!(
                    (0.0..=9_007_199_254_740_991.0).contains(&n) && n.fract() == 0.0,
                    "NX_REHASH_MEMORY_BUDGET: maxLiveReadBytes must be a nonnegative safe integer"
                );
                Some(AtomicU64::new(n as u64))
            }
        };
        Ok(Self { remaining })
    }

    pub(crate) fn read(
        &self,
        path: &Path,
        buffer: &mut [u8],
        mut consume: impl FnMut(&[u8]),
    ) -> Result<bool> {
        let Ok(mut file) = File::open(path) else {
            return Ok(false);
        };
        // Reject a large regular file before touching its first page.
        let mut charged = if self.remaining.is_some() {
            self.reserve(0, file.metadata().map_or(0, |m| m.len()))?
        } else {
            u64::MAX
        };
        let mut count = 0u64;
        let complete = loop {
            if count == charged {
                let metadata = file.metadata().ok();
                let size = metadata.as_ref().map_or(0, |m| m.len());
                if size <= count
                    && metadata.is_some_and(|m| m.is_file())
                    && has_stored_extent(&file)
                {
                    break true;
                }
                // A growing file or a size-less stream needs another page.
                // Reserve it before issuing a read that could populate it.
                charged = self.reserve(charged, size.max(count + 1))?;
            }
            let limit = (charged - count).min(buffer.len() as u64) as usize;
            match file.read(&mut buffer[..limit]) {
                Ok(0) => break true,
                Ok(n) => {
                    count += n as u64;
                    consume(&buffer[..n]);
                }
                Err(e) if e.kind() == ErrorKind::Interrupted => continue,
                Err(_) => break false,
            }
        };
        if let Some(remaining) = &self.remaining {
            // A short stream, a file that shrank, or an EOF probe can use
            // fewer pages than reserved. Keep only the charge for bytes read.
            let used = page_bytes(count);
            if used < charged {
                remaining.fetch_add(charged - used, Ordering::Relaxed);
            }
        }
        Ok(complete)
    }

    fn reserve(&self, charged: u64, size: u64) -> Result<u64> {
        let remaining = self
            .remaining
            .as_ref()
            .expect("only a limited read reserves bytes");
        let bytes = page_bytes(size);
        ensure!(
            remaining
                .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |left| {
                    left.checked_sub(bytes - charged)
                })
                .is_ok(),
            BUDGET_EXCEEDED
        );
        Ok(bytes)
    }
}

// Procfs, sysfs and similar virtual volumes report no storage blocks. Their
// regular entries can return bytes beyond st_size. Read those through the
// page budget until the descriptor itself returns EOF.
#[cfg(any(target_os = "linux", target_os = "macos", target_os = "freebsd"))]
fn has_stored_extent(file: &File) -> bool {
    nix::sys::statfs::fstatfs(file).is_ok_and(|fs| fs.blocks() != 0)
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "freebsd")))]
fn has_stored_extent(_: &File) -> bool {
    true
}

pub(super) fn page_bytes(size: u64) -> u64 {
    #[cfg(all(unix, not(target_family = "wasm")))]
    let page = *PAGE_SIZE;
    #[cfg(not(all(unix, not(target_family = "wasm"))))]
    let page = 4096;
    size.div_ceil(page).saturating_mul(page)
}

#[cfg(all(unix, not(target_family = "wasm")))]
static PAGE_SIZE: std::sync::LazyLock<u64> = std::sync::LazyLock::new(|| {
    use nix::libc;
    u64::try_from(unsafe { libc::sysconf(libc::_SC_PAGESIZE) })
        .ok()
        .filter(|n| *n > 0)
        .unwrap_or(4096)
});

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn pays_for_growth_before_reading_the_next_page() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("output");
        let page = page_bytes(1) as usize;
        std::fs::write(&path, vec![1; page]).unwrap();
        let budget = RehashReadBudget::new(Some(page as f64)).unwrap();
        let mut count = 0;
        let error = budget
            .read(&path, &mut vec![0; page / 2 + 1], |chunk| {
                if count == 0 {
                    File::options()
                        .append(true)
                        .open(&path)
                        .unwrap()
                        .write_all(&vec![2; page])
                        .unwrap();
                }
                assert!(chunk.iter().all(|b| *b == 1));
                count += chunk.len();
            })
            .unwrap_err();
        assert_eq!(count, page);
        assert!(error.to_string().contains("NX_REHASH_MEMORY_BUDGET"));
    }

    #[test]
    fn rejects_before_reading_and_charges_nothing_for_missing_or_empty_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("file");
        let page = page_bytes(1);
        let budget = RehashReadBudget::new(Some((page - 1) as f64)).unwrap();
        let read = || budget.read(&path, &mut [0; 16], |_| panic!("no data may be read"));
        assert!(!read().unwrap());
        std::fs::write(&path, []).unwrap();
        assert!(read().unwrap());
        std::fs::write(&path, [1]).unwrap();
        assert!(
            read()
                .unwrap_err()
                .to_string()
                .contains("NX_REHASH_MEMORY_BUDGET")
        );
        for value in [-1.0, 0.5, f64::NAN, f64::INFINITY, 9_007_199_254_740_992.0] {
            let Err(error) = RehashReadBudget::new(Some(value)) else {
                panic!("accepted {value}")
            };
            assert!(error.to_string().contains("NX_REHASH_MEMORY_BUDGET"));
        }
    }
}
