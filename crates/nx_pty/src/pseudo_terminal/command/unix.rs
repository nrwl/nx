use std::{
    io::{Read, Stdin, Write},
    os::fd::AsRawFd,
};

use mio::{unix::SourceFd, Events};
use tracing::trace;

pub fn handle_path_space(path: String) -> String {
    if path.contains(' ') {
        format!("'{}'", path)
    } else {
        path
    }
}

pub fn write_to_pty(stdin: &mut Stdin, writer: &mut impl Write) -> anyhow::Result<()> {
    let mut buffer = [0; 1024];

    let mut poll = mio::Poll::new()?;
    let mut events = Events::with_capacity(3);

    // Register stdin to the poll instance
    let token = mio::Token(0);
    poll.registry()
        .register(
            &mut SourceFd(&stdin.as_raw_fd()),
            token,
            mio::Interest::READABLE,
        )
        .map_err(|e| anyhow::anyhow!("Failed to register stdin to poll: {}", e))?;

    loop {
        // Poll for events
        if let Err(e) = poll.poll(&mut events, None) {
            if e.kind() == std::io::ErrorKind::Interrupted {
                continue;
            }
            trace!("poll error: {:?}", e);
            anyhow::bail!("Failed to poll for events: {}", e);
        }

        for event in events.iter().map(|x| x.token()) {
            match event {
                mio::Token(0) => {
                    // Read data from stdin
                    loop {
                        match stdin.read(&mut buffer) {
                            Ok(n) => {
                                writer.write_all(&buffer[..n])?;
                                writer.flush()?;
                            }
                            Err(e) => {
                                if e.kind() == std::io::ErrorKind::WouldBlock {
                                    break;
                                } else if e.kind() == std::io::ErrorKind::Interrupted {
                                    continue;
                                }
                            }
                        }
                    }
                }
                _ => unreachable!(),
            }
        }
    }
}
