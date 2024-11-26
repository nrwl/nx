use dashmap::DashMap;
use napi::bindgen_prelude::{Object, ToNapiValue};
use napi::{sys, Env};
use std::collections::hash_map::RandomState;
use std::ops::{Deref, DerefMut};

#[derive(Debug)]
pub struct NapiDashMap<K, V, S = RandomState>(DashMap<K, V, S>)
where
    K: Eq + PartialEq + std::hash::Hash,
    S: std::hash::BuildHasher + std::clone::Clone;
impl<K, V> NapiDashMap<K, V, RandomState>
where
    K: Eq + PartialEq + std::hash::Hash,
{
    pub fn new() -> Self {
        Self(DashMap::<K, V>::with_hasher(RandomState::default()))
    }
}

impl<K, V> Default for NapiDashMap<K, V, RandomState>
where
    K: Eq + PartialEq + std::hash::Hash,
{
    fn default() -> Self {
        Self::new()
    }
}

impl<K, V, S> Deref for NapiDashMap<K, V, S>
where
    K: Eq + PartialEq + std::hash::Hash,
    S: std::hash::BuildHasher + std::clone::Clone,
{
    type Target = DashMap<K, V, S>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<K, V, S> DerefMut for NapiDashMap<K, V, S>
where
    K: Eq + PartialEq + std::hash::Hash,
    S: std::hash::BuildHasher + std::clone::Clone,
{
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl<K, V, S> ToNapiValue for NapiDashMap<K, V, S>
where
    K: AsRef<str> + std::cmp::Eq + std::hash::Hash,
    S: std::hash::BuildHasher + std::clone::Clone,
    V: ToNapiValue,
{
    unsafe fn to_napi_value(raw_env: sys::napi_env, val: Self) -> napi::Result<sys::napi_value> {
        let env = Env::from(raw_env);
        let mut obj = env.create_object()?;
        for (k, v) in val.0.into_iter() {
            obj.set(k.as_ref(), v)?;
        }

        unsafe { Object::to_napi_value(raw_env, obj) }
    }
}
