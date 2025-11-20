use crate::error::Result;
use crossbeam_channel::{bounded, Receiver, Sender};
use serde_json::Value;
use tokio::sync::oneshot;

/// Request item in queue
pub struct QueuedRequest {
    pub id: u64,
    pub message: Value,
    pub response_tx: oneshot::Sender<Result<Value>>,
}

/// Message queue for handling serial request/response
pub struct RequestQueue {
    sender: Sender<QueuedRequest>,
    receiver: Receiver<QueuedRequest>,
}

impl RequestQueue {
    /// Create new request queue with given capacity
    pub fn new(capacity: usize) -> Self {
        let (sender, receiver) = bounded(capacity);
        RequestQueue { sender, receiver }
    }

    /// Queue a request and get a receiver for the response
    pub fn queue(&self, request: QueuedRequest) -> Result<()> {
        self.sender
            .send(request)
            .map_err(|_| crate::error::DaemonClientError::QueueError)
    }

    /// Get the next queued request (blocking)
    pub fn next(&self) -> Option<QueuedRequest> {
        self.receiver.recv().ok()
    }

    /// Try to get the next queued request (non-blocking)
    pub fn try_next(&self) -> Option<QueuedRequest> {
        self.receiver.try_recv().ok()
    }

    /// Check if queue is empty
    pub fn is_empty(&self) -> bool {
        self.receiver.is_empty()
    }
}

impl Clone for RequestQueue {
    fn clone(&self) -> Self {
        RequestQueue {
            sender: self.sender.clone(),
            receiver: self.receiver.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_queue_request() {
        let queue = RequestQueue::new(10);
        let (tx, rx) = oneshot::channel();

        let request = QueuedRequest {
            id: 1,
            message: serde_json::json!({"type": "TEST"}),
            response_tx: tx,
        };

        queue.queue(request).unwrap();
        assert!(!queue.is_empty());

        let next = queue.next();
        assert!(next.is_some());
        assert_eq!(next.unwrap().id, 1);
    }

    #[test]
    fn test_queue_fifo() {
        let queue = RequestQueue::new(10);

        for i in 0..5 {
            let (tx, _rx) = oneshot::channel();
            let request = QueuedRequest {
                id: i,
                message: serde_json::json!({"type": "TEST"}),
                response_tx: tx,
            };
            queue.queue(request).unwrap();
        }

        for i in 0..5 {
            let next = queue.next();
            assert_eq!(next.unwrap().id, i);
        }
    }
}
