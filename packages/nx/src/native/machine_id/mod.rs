pub fn get_machine_id() -> String {
    #[cfg(all(not(target_arch = "wasm32"), not(target_os = "android")))]
    return machine_uid::get().unwrap_or(String::from("machine"));

    #[cfg(any(target_arch = "wasm32", target_os = "android"))]
    {
        use crate::native::hasher::hash;
        use std::fs::read_to_string;

        hash(
            read_to_string("/var/lib/dbus/machine-id")
                .or_else(|_| read_to_string("/etc/machine-id"))
                .unwrap_or(String::from("machine"))
                .as_bytes(),
        )
    }
}
