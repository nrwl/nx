use std::sync::{Condvar, LockResult, Mutex, MutexGuard};

pub struct NxMutex<T>(Mutex<T>);

impl <T> NxMutex<T> {
    pub fn new(value: T) -> Self {
        Self(Mutex::new(value))
    }
    pub fn lock(&self) -> LockResult<MutexGuard<'_, T>> {
        self.0.lock()
    }
}

// pub struct NxMutexGuard<'a, T>(LockResult<MutexGuard<'a, T>>);
//
// impl <T> Deref for NxMutexGuard<'_, T> {
//     type Target = T;
//
//     fn deref(&self) -> &Self::Target {
//         &*self.0.unwrap()
//     }
// }
//
// impl <'a, T> DerefMut for NxMutexGuard<'a, T> {
//     fn deref_mut(&mut self) -> &mut Self::Target {
//         &mut *self.0.unwrap()
//     }
// }

pub struct NxCondvar(Condvar);

impl NxCondvar {
    pub fn new() -> Self {
        Self(Condvar::new())
    }

    pub fn wait<'a, T, F>(&self, mutex_guard: MutexGuard<'a, T>, condition: F) -> LockResult<MutexGuard<'a, T>>
    where
        F: Fn(&mut T) -> bool
    {
        self.0.wait_while(mutex_guard, condition)
    }
}
