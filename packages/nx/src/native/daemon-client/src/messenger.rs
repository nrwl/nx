use crate::error::Result;
use serde_json::{json, Value};

const MESSAGE_END_MARKER: &[u8] = b"\n"; // Using newline as message delimiter

/// Handles message serialization and framing with daemon
pub struct DaemonMessenger {
    buffer: Vec<u8>,
}

impl DaemonMessenger {
    pub fn new() -> Self {
        DaemonMessenger {
            buffer: Vec::with_capacity(8192),
        }
    }

    /// Serialize a message to bytes with framing
    pub fn serialize_message(&self, msg: &Value) -> Result<Vec<u8>> {
        let json_str = serde_json::to_string(msg)?;
        let mut data = json_str.into_bytes();
        data.extend_from_slice(MESSAGE_END_MARKER);
        Ok(data)
    }

    /// Deserialize a message from bytes
    pub fn deserialize_message(&self, data: &[u8]) -> Result<Value> {
        let json_str = String::from_utf8(data.to_vec())
            .map_err(|e| crate::error::DaemonClientError::DeserializationError(e.to_string()))?;

        let json_str = json_str.trim_end_matches(|c: char| c.is_whitespace());

        // Try JSON-RPC first
        let msg: Value = serde_json::from_str(json_str)?;
        Ok(msg)
    }

    /// Create a handshake message
    pub fn create_handshake(version: &str) -> Value {
        json!({
            "type": "HANDSHAKE",
            "version": version
        })
    }

    /// Create a request message
    pub fn create_request(msg_type: &str, payload: Option<Value>) -> Value {
        let mut msg = json!({
            "type": msg_type
        });

        if let Some(payload) = payload {
            if let Some(obj) = msg.as_object_mut() {
                if let Some(payload_obj) = payload.as_object() {
                    for (k, v) in payload_obj {
                        obj.insert(k.clone(), v.clone());
                    }
                }
            }
        }

        msg
    }

    /// Parse response and extract result or error
    pub fn parse_response(&self, response: Value) -> Result<Value> {
        // Handle error responses
        if response.get("error").is_some() {
            let error_msg = response
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or("Unknown error");
            return Err(crate::error::DaemonClientError::DaemonError(
                error_msg.to_string(),
            ));
        }

        // Return the result
        response
            .get("result")
            .cloned()
            .or_else(|| Some(response.clone()))
            .ok_or_else(|| {
                crate::error::DaemonClientError::InvalidResponse
            })
    }
}

impl Default for DaemonMessenger {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serialize_message() {
        let messenger = DaemonMessenger::new();
        let msg = json!({ "type": "TEST" });
        let serialized = messenger.serialize_message(&msg).unwrap();
        assert!(serialized.ends_with(b"\n"));
    }

    #[test]
    fn test_deserialize_message() {
        let messenger = DaemonMessenger::new();
        let data = br#"{"type":"TEST","value":123}"#;
        let msg = messenger.deserialize_message(data).unwrap();
        assert_eq!(msg["type"], "TEST");
        assert_eq!(msg["value"], 123);
    }

    #[test]
    fn test_create_handshake() {
        let handshake = DaemonMessenger::create_handshake("19.0.0");
        assert_eq!(handshake["type"], "HANDSHAKE");
        assert_eq!(handshake["version"], "19.0.0");
    }

    #[test]
    fn test_create_request() {
        let req = DaemonMessenger::create_request("REQUEST_PROJECT_GRAPH", None);
        assert_eq!(req["type"], "REQUEST_PROJECT_GRAPH");
    }
}
