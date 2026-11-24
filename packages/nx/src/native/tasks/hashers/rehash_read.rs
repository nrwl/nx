use std::io::{ErrorKind, Read};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use anyhow::{Result, bail};

/// The caller may bound the page cache touched by live reads. Charge each
/// distinct file before reading its bytes, rounded up to a whole OS page.
#[derive(Default)]
pub(crate) struct RehashReadBudget {
    remaining: Option<AtomicU64>,
}

impl RehashReadBudget {
    pub(crate) fn new(bytes: Option<i64>) -> Result<Self> {
        Ok(Self {
            remaining: bytes
                .map(|n| u64::try_from(n).map(AtomicU64::new))
                .transpose()?,
        })
    }

    pub(crate) fn read(
        &self,
        path: &Path,
        buffer: &mut [u8],
        mut consume: impl FnMut(&[u8]),
    ) -> Result<bool> {
        let Ok(mut file) = std::fs::File::open(path) else {
            return Ok(false);
        };
        // Normal files reserve their pages up front. Pseudo-files and files
        // that grow after stat also charge any bytes beyond their stated size.
        let mut charged = if self.remaining.is_some() {
            self.reserve(file.metadata().map_or(0, |m| m.len()), 0)?
        } else {
            u64::MAX
        };
        let mut count = 0u64;
        loop {
            match file.read(buffer) {
                Ok(0) => return Ok(true),
                Ok(n) => {
                    count += n as u64;
                    if count > charged {
                        charged = self.reserve(count, charged)?;
                    }
                    consume(&buffer[..n]);
                }
                Err(e) if e.kind() == ErrorKind::Interrupted => continue,
                Err(_) => return Ok(false),
            }
        }
    }

    fn reserve(&self, size: u64, charged: u64) -> Result<u64> {
        let remaining = self
            .remaining
            .as_ref()
            .expect("only a limited read reserves bytes");
        #[cfg(all(unix, not(target_family = "wasm")))]
        let page = *PAGE_SIZE;
        #[cfg(not(all(unix, not(target_family = "wasm"))))]
        let page = 4096;
        let bytes = size.div_ceil(page).saturating_mul(page);
        if remaining
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |left| {
                left.checked_sub(bytes - charged)
            })
            .is_err()
        {
            bail!("NX_REHASH_MEMORY_BUDGET: settled file reads exceed the supplied byte budget");
        }
        Ok(bytes)
    }
}

#[cfg(all(unix, not(target_family = "wasm")))]
static PAGE_SIZE: std::sync::LazyLock<u64> = std::sync::LazyLock::new(|| {
    use nix::libc;
    u64::try_from(unsafe { libc::sysconf(libc::_SC_PAGESIZE) })
        .ok()
        .filter(|n| *n > 0)
        .unwrap_or(4096)
});
