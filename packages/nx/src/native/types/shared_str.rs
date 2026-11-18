use std::cell::RefCell;
use std::collections::HashMap;
use std::fmt;
use std::ops::Deref;
use std::sync::Arc;

use napi::bindgen_prelude::{FromNapiValue, ToNapiValue, TypeName, ValidateNapiValue, ValueType};
use napi::sys;

thread_local! {
    // Maps Arc address -> the JS string already created for it in the current
    // conversion. The Arc is kept alive in the entry so its address cannot be
    // freed and reused for a different string while the cache holds it.
    static HANDLE_CACHE: RefCell<Option<HashMap<usize, (Arc<str>, sys::napi_value)>>> =
        const { RefCell::new(None) };
}

/// Clears the handle cache when the installing conversion finishes.
pub struct SharedStrHandleCacheGuard {
    // !Send: napi handles are only valid on the JS thread that created them.
    _not_send: std::marker::PhantomData<*const ()>,
}

impl Drop for SharedStrHandleCacheGuard {
    fn drop(&mut self) {
        HANDLE_CACHE.with(|cache| *cache.borrow_mut() = None);
    }
}

/// A reference-counted immutable string that crosses the napi boundary as a
/// plain JS string. Use it for map keys/values that repeat across many
/// entries (e.g. per-task hash details on large graphs): clones share one
/// allocation instead of duplicating the bytes per entry.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct SharedStr(Arc<str>);

impl SharedStr {
    /// Until the returned guard drops, `to_napi_value` calls on this thread
    /// create one JS string per unique Arc and reuse its handle for every
    /// clone. napi handles are only valid within the native call that created
    /// them, so install this around a single synchronous conversion and let
    /// the guard drop before returning to JS. Not reentrant: a nested install
    /// replaces the current cache.
    pub fn install_handle_cache() -> SharedStrHandleCacheGuard {
        HANDLE_CACHE.with(|cache| *cache.borrow_mut() = Some(HashMap::new()));
        SharedStrHandleCacheGuard {
            _not_send: std::marker::PhantomData,
        }
    }
}

impl From<String> for SharedStr {
    fn from(value: String) -> Self {
        Self(Arc::from(value))
    }
}

impl From<Arc<str>> for SharedStr {
    fn from(value: Arc<str>) -> Self {
        Self(value)
    }
}

impl AsRef<str> for SharedStr {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl Deref for SharedStr {
    type Target = str;

    fn deref(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for SharedStr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl TypeName for SharedStr {
    fn type_name() -> &'static str {
        "string"
    }

    fn value_type() -> ValueType {
        ValueType::String
    }
}

impl ValidateNapiValue for SharedStr {}

impl FromNapiValue for SharedStr {
    unsafe fn from_napi_value(env: sys::napi_env, val: sys::napi_value) -> napi::Result<Self> {
        Ok(Self(Arc::from(unsafe {
            String::from_napi_value(env, val)
        }?)))
    }
}

impl ToNapiValue for SharedStr {
    unsafe fn to_napi_value(env: sys::napi_env, val: Self) -> napi::Result<sys::napi_value> {
        unsafe { Self::to_napi_value_ref(env, &val) }
    }
}

impl SharedStr {
    // Borrow pooled keys during conversion instead of incrementing/decrementing
    // their Arc for every task entry. Cache misses still retain the Arc.
    unsafe fn to_napi_value_ref(env: sys::napi_env, val: &Self) -> napi::Result<sys::napi_value> {
        let address = Arc::as_ptr(&val.0) as *const () as usize;
        let cached = HANDLE_CACHE.with(|cache| {
            cache
                .borrow()
                .as_ref()
                .and_then(|entries| entries.get(&address).map(|(_, handle)| *handle))
        });
        if let Some(handle) = cached {
            return Ok(handle);
        }
        let handle = unsafe { <&str as ToNapiValue>::to_napi_value(env, &val.0) }?;
        HANDLE_CACHE.with(|cache| {
            if let Some(entries) = cache.borrow_mut().as_mut() {
                entries.insert(address, (val.0.clone(), handle));
            }
        });
        Ok(handle)
    }
}

/// A JS object assembled from unique string entries. Keeping the entries
/// contiguous avoids rebuilding a native hash table just to enumerate it at
/// the N-API boundary. Both keys and values use SharedStr's handle cache.
#[derive(Debug)]
pub struct SharedStrMap(SharedStrMapEntries);

#[derive(Debug)]
enum SharedStrMapEntries {
    Owned(Vec<(SharedStr, SharedStr)>),
    Indexed {
        keys: Arc<[SharedStr]>,
        entries: Vec<(u32, SharedStr)>,
    },
}

impl Default for SharedStrMap {
    fn default() -> Self {
        Self(SharedStrMapEntries::Owned(Vec::new()))
    }
}

impl SharedStrMap {
    #[cfg(test)]
    pub(crate) fn entry_capacity(&self) -> usize {
        match &self.0 {
            SharedStrMapEntries::Owned(entries) => entries.capacity(),
            SharedStrMapEntries::Indexed { entries, .. } => entries.capacity(),
        }
    }

    /// Keep the assembly buffer and share its key table across tasks. A u32 key
    /// index replaces each fat Arc<str>, avoiding per-entry key clones and a
    /// second, larger allocation just before converting the results to JS.
    /// Callers must resolve duplicate keys before constructing the map.
    pub(crate) fn from_indexed_entries(
        keys: Arc<[SharedStr]>,
        entries: Vec<(u32, SharedStr)>,
    ) -> Self {
        Self(SharedStrMapEntries::Indexed { keys, entries })
    }
}

impl From<HashMap<SharedStr, SharedStr>> for SharedStrMap {
    fn from(value: HashMap<SharedStr, SharedStr>) -> Self {
        Self(SharedStrMapEntries::Owned(value.into_iter().collect()))
    }
}

impl FromNapiValue for SharedStrMap {
    unsafe fn from_napi_value(env: sys::napi_env, val: sys::napi_value) -> napi::Result<Self> {
        let entries = unsafe { HashMap::<SharedStr, SharedStr>::from_napi_value(env, val) }?;
        Ok(entries.into())
    }
}

impl ToNapiValue for SharedStrMap {
    unsafe fn to_napi_value(env: sys::napi_env, val: Self) -> napi::Result<sys::napi_value> {
        let napi_env = napi::Env::from(env);
        let object = napi::bindgen_prelude::Object::new(&napi_env)?;
        let object_raw = unsafe { napi::bindgen_prelude::Object::to_napi_value(env, object) }?;
        let set_entry = |key: &SharedStr, value: SharedStr| -> napi::Result<()> {
            // Keep ordinary Set semantics, including inherited setters. Bulk
            // DefineProperty would change observable behavior for those keys.
            let key = unsafe { SharedStr::to_napi_value_ref(env, key) }?;
            let value = unsafe { SharedStr::to_napi_value(env, value) }?;
            napi::check_status!(unsafe { sys::napi_set_property(env, object_raw, key, value) })?;
            Ok(())
        };
        match val.0 {
            SharedStrMapEntries::Owned(entries) => {
                for (key, value) in entries {
                    set_entry(&key, value)?;
                }
            }
            SharedStrMapEntries::Indexed { keys, entries } => {
                for (id, value) in entries {
                    set_entry(&keys[id as usize], value)?;
                }
            }
        }
        Ok(object_raw)
    }
}
