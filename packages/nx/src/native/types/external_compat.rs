use napi::bindgen_prelude::*;
use std::ops::Deref;

/// Compatibility wrapper for storing `External<T>` references in struct fields.
///
/// In napi v3, `External<T>` no longer implements `FromNapiValue` — it only
/// supports `FromNapiRef` (`&External<T>`) and `FromNapiMutRef` (`&mut External<T>`).
///
/// This wrapper stores a pointer to the `External<T>` obtained via `FromNapiRef`.
/// The pointer is valid for `'static` because napi pins the External on the JS
/// heap for the lifetime of the reference.
///
/// We use a raw pointer instead of `&'static External<T>` because two call sites
/// (`TaskDetails` and `TaskHistory`) need `&mut` access for `NxDbConnection::transaction()`.
/// Rust's aliasing rules prohibit obtaining `&mut` from `&'static`.
pub struct StoredExternal<T: 'static> {
    /// Valid for `'static` — obtained from `FromNapiRef` which returns `&'static External<T>`.
    ptr: *mut External<T>,
}

// SAFETY: The underlying External lives on the JS heap for 'static.
// Send/Sync when T is Send, matching v2 External<T> behavior.
unsafe impl<T: Send + 'static> Send for StoredExternal<T> {}
unsafe impl<T: Send + 'static> Sync for StoredExternal<T> {}

impl<T: 'static> TypeName for StoredExternal<T> {
    fn type_name() -> &'static str {
        "External"
    }

    fn value_type() -> napi::ValueType {
        napi::ValueType::External
    }
}

impl<T: 'static> ValidateNapiValue for StoredExternal<T> {}

impl<T: 'static> FromNapiValue for StoredExternal<T> {
    unsafe fn from_napi_value(
        env: napi::sys::napi_env,
        napi_val: napi::sys::napi_value,
    ) -> napi::Result<Self> {
        let reference: &'static External<T> =
            unsafe { External::<T>::from_napi_ref(env, napi_val)? };
        Ok(StoredExternal {
            ptr: reference as *const External<T> as *mut External<T>,
        })
    }
}

impl<T: 'static> Deref for StoredExternal<T> {
    type Target = T;
    fn deref(&self) -> &Self::Target {
        unsafe { &*self.ptr }
    }
}

impl<T: 'static> StoredExternal<T> {
    /// Create a StoredExternal from a reference to an External.
    ///
    /// Used when napi methods accept `&External<T>` (which generates correct
    /// TypeScript types) but need to store the reference in a struct field.
    ///
    /// Safe because napi's `FromNapiRef` for `External<T>` returns `&'static External<T>`.
    pub fn from_ref(ext: &External<T>) -> Self {
        StoredExternal {
            ptr: ext as *const External<T> as *mut External<T>,
        }
    }

    /// Get a mutable reference to the inner value.
    ///
    /// # Safety
    /// Safe when called from a `&mut self` napi method — the JS runtime
    /// guarantees single-threaded access, and `&mut self` ensures exclusivity.
    pub fn deref_mut(&mut self) -> &mut T {
        unsafe { &mut *self.ptr }
    }
}

impl<T: 'static> AsRef<T> for StoredExternal<T> {
    fn as_ref(&self) -> &T {
        self
    }
}
