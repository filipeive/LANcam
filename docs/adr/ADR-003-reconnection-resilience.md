# ADR-003: Signaling & WebRTC Reconnection & Network Resilience

## Status
**Accepted**

## Date
2026-09-19

## Context

Mobile Wi-Fi connections can experience transient signal drops, roaming between access points, or temporary latency spikes. A production camera streaming solution must handle network disruptions gracefully without requiring manual intervention from stream operators.

## Decision

1. **Dual-Layer Reconnection Architecture**:
   - **WebSocket Signaling Layer**:
     - Heartbeat ping/pong every 5 seconds (`WS_PING_INTERVAL_MS`).
     - Connection declared dead if no pong received within 10 seconds (`WS_PONG_TIMEOUT_MS`).
     - Reconnection uses exponential backoff with jitter: delays of 1s, 2s, 4s, 8s, capping at 10s (`RECONNECT_DELAYS_MS`).
   - **WebRTC Peer Connection Layer**:
     - Monitors `iceConnectionState` and `connectionState`.
     - Triggers `restartIce()` when state enters `'disconnected'` or `'failed'`.
     - Falls back to full peer renegotiation if ICE restart does not recover within 5 seconds.

2. **Camera Media State Preservation**:
   - If Wi-Fi drops and reconnects, the Camera Web Client retains its current media track (`MediaStreamTrack`) and camera hardware constraints.
   - Upon signaling reconnection, the camera automatically re-registers with its existing `sessionToken` and `cameraId`.

3. **Viewer Auto-Healing**:
   - OBS Viewer automatically displays a subtle connection state indicator if stream stalls and silently renegotiates when camera returns online.

## Consequences

### Positive
- Wi-Fi dropouts under 10 seconds recover automatically without stream interruption in OBS.
- Eliminates manual browser reloads on smartphone or OBS browser source.

### Negative
- Slight temporary freeze during ICE candidate gathering upon AP roaming.
