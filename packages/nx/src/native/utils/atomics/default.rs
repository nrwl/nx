use parking_lot::{Condvar, Mutex, MutexGuard};

pub struct NxMutex<T>(Mutex<T>);

impl <T> NxMutex<T> {
    pub fn new(value: T) -> Self {
        Self(Mutex::new(value))
    }
    pub fn lock(&self) -> anyhow::Result<MutexGuard<'_, T>> {
        Ok(self.0.lock())
    }
}

pub struct NxCondvar(Condvar);

impl NxCondvar {
    pub fn new() -> Self {
        Self(Condvar::new())
    }

    pub fn wait<'a, T, F>(&'a self, mut guard: MutexGuard<'a, T>, condition: F) -> anyhow::Result<MutexGuard<'a, T>>
        where
            F: Fn(&MutexGuard<'a, T>) -> bool
    {
        if condition(&guard) {
            self.0.wait(&mut guard);
        }
        Ok(guard)
    }

    pub fn notify_all(&self) {
        self.0.notify_all();
    }
}
