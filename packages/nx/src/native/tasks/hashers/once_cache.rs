use std::sync::Arc;

use dashmap::DashMap;
use once_cell::sync::OnceCell;

/// Concurrent compute-once cache for expensive-to-build, cheap-to-share values.
///
/// The first caller for a key runs `init` while the map itself stays unlocked
/// (the cell is detached from the map before computing, so other keys on the
/// same shard are never blocked). Concurrent callers for the same key wait on
/// the cell and then share the result; hits are an Arc refcount bump, never a
/// deep copy. A failed `init` leaves the cell empty, so the next caller
/// retries instead of observing a cached error.
pub(crate) struct OnceCache<T>(DashMap<String, Arc<OnceCell<Arc<T>>>>);

impl<T> OnceCache<T> {
    pub fn new() -> Self {
        Self(DashMap::new())
    }

    pub fn get_or_try_init<E>(
        &self,
        key: String,
        init: impl FnOnce() -> Result<T, E>,
    ) -> Result<Arc<T>, E> {
        let cell = self
            .0
            .entry(key)
            .or_insert_with(|| Arc::new(OnceCell::new()))
            .clone();
        cell.get_or_try_init(|| init().map(Arc::new)).cloned()
    }

    #[cfg(test)]
    pub fn len(&self) -> usize {
        self.0.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn computes_once_and_shares_the_result() {
        let cache: OnceCache<String> = OnceCache::new();
        let mut computations = 0;

        let first = cache
            .get_or_try_init("key".into(), || {
                computations += 1;
                Ok::<_, ()>("value".to_string())
            })
            .unwrap();
        let second = cache
            .get_or_try_init("key".into(), || {
                computations += 1;
                Ok::<_, ()>("other".to_string())
            })
            .unwrap();

        assert_eq!(computations, 1);
        assert!(Arc::ptr_eq(&first, &second));
        assert_eq!(cache.len(), 1);
    }

    #[test]
    fn failed_init_is_not_cached() {
        let cache: OnceCache<String> = OnceCache::new();

        let failed = cache.get_or_try_init("key".into(), || Err("boom"));
        assert_eq!(failed.unwrap_err(), "boom");

        let recovered = cache
            .get_or_try_init("key".into(), || Ok::<_, &str>("value".to_string()))
            .unwrap();
        assert_eq!(*recovered, "value");
    }
}
