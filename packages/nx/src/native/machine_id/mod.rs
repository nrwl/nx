pub fn get_machine_id() -> String {
    #[cfg(not(target_arch = "wasm32"))]
    return machine_uid::get().unwrap_or(String::from("machine"));

    #[cfg(target_arch = "wasm32")]
    {
        use crate::native::hasher::hash;
        use crate::native::tasks::hashers::create_command_builder;
        use std::fs::read_to_string;

        hash(
            read_to_string("/var/lib/dbus/machine-id")
                .or_else(|_| read_to_string("/etc/machine-id"))
                .or_else(|_| {
                    let mut command_builder = create_command_builder();

                    command_builder.arg("hostname");

                    std::str::from_utf8(
                        &command_builder
                            .output()
                            .map_err(|_| anyhow::anyhow!("Failed to get hostname"))?
                            .stdout,
                    )
                    .map_err(anyhow::Error::from)
                    .map(|s| s.trim().to_string())
                })
                .unwrap_or(String::from("machine"))
                .as_bytes(),
        )
    }
}
