use crate::error::Result;
use std::time::Duration;
use tokio_retry::strategy::ExponentialBackoff;
use tokio_retry::Retry;

/// Configuration for reconnection strategy
#[derive(Debug, Clone)]
pub struct ReconnectConfig {
    pub initial_delay_ms: u64,
    pub max_delay_ms: u64,
    pub max_attempts: usize,
}

impl Default for ReconnectConfig {
    fn default() -> Self {
        ReconnectConfig {
            initial_delay_ms: 10,      // Start at 10ms
            max_delay_ms: 5000,        // Cap at 5 seconds
            max_attempts: 30,          // Try up to 30 times
        }
    }
}

impl ReconnectConfig {
    /// Create exponential backoff strategy from config
    pub fn create_strategy(&self) -> impl Iterator<Item = Duration> {
        ExponentialBackoff::from_millis(self.initial_delay_ms)
            .max_delay(Duration::from_millis(self.max_delay_ms))
            .take(self.max_attempts)
    }
}

/// Retry a function with exponential backoff
pub async fn retry_with_backoff<F, Fut, T>(
    f: F,
    config: &ReconnectConfig,
) -> Result<T>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T>>,
{
    let strategy = config.create_strategy();

    Retry::spawn(strategy, || async {
        f().await
    })
    .await
    .map_err(|_| {
        crate::error::DaemonClientError::ReconnectionFailed(config.max_attempts)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reconnect_config_default() {
        let config = ReconnectConfig::default();
        assert_eq!(config.initial_delay_ms, 10);
        assert_eq!(config.max_delay_ms, 5000);
        assert_eq!(config.max_attempts, 30);
    }

    #[test]
    fn test_backoff_strategy() {
        let config = ReconnectConfig::default();
        let strategy = config.create_strategy();
        let durations: Vec<_> = strategy.collect();

        assert_eq!(durations.len(), 30);
        assert_eq!(durations[0], Duration::from_millis(10));
        // Each should be exponentially larger
        assert!(durations[1] > durations[0]);
        assert!(durations[2] > durations[1]);
    }

    #[tokio::test]
    async fn test_retry_success() {
        let mut attempts = 0;
        let result = retry_with_backoff(
            || async {
                attempts += 1;
                if attempts < 3 {
                    Err(crate::error::DaemonClientError::ConnectionError(
                        "not yet".to_string(),
                    ))
                } else {
                    Ok::<_, crate::error::DaemonClientError>("success".to_string())
                }
            },
            &ReconnectConfig::default(),
        )
        .await;

        assert!(result.is_ok());
        assert_eq!(attempts, 3);
    }

    #[tokio::test]
    async fn test_retry_exhausted() {
        let config = ReconnectConfig {
            max_attempts: 3,
            ..Default::default()
        };

        let result = retry_with_backoff(
            || async {
                Err::<String, _>(crate::error::DaemonClientError::ConnectionError(
                    "always fails".to_string(),
                ))
            },
            &config,
        )
        .await;

        assert!(result.is_err());
    }
}
