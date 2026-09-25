# ADR-002: OBS Browser Source Compatibility & Latency Optimization

## Status
**Accepted**

## Date
2026-09-19

## Context

LANCam uses OBS Studio's built-in **Browser Source** (CEF - Chromium Embedded Framework) to render camera streams on stream scenes. OBS Browser Source has specific characteristics and constraints:

1. **Chromium Engine**: Modern OBS releases use Chromium v100+, supporting standard HTML5 `<video>` and WebRTC (`RTCPeerConnection`).
2. **Audio Flags**: WebRTC autoplay policies require video elements to set `autoplay`, `playsinline`, and `muted` (if audio is unused) or explicitly allow audio playback.
3. **Framerate & Performance**: Hardware acceleration is optional in OBS Browser Source. Excess JS rendering overhead or heavy DOM structures degrade capture FPS.
4. **Latency Requirements**: Real-time camera feeds require < 200ms latency. Standard HLS or RTMP introduce 2–5 second delays.

## Decision

1. **Dedicated Minimal Viewer Route (`/viewer`)**:
   - Zero UI chrome or overlay elements in standard viewer mode.
   - Clean HTML5 `<video>` element styled with `width: 100vw; height: 100vh; object-fit: cover; background: transparent;`.
   - Disables all non-essential DOM operations during active playback.

2. **WebRTC Direct Stream Playback**:
   - `RTCPeerConnection` connected directly from Camera peer to Viewer peer.
   - SDP negotiated with `playoutDelayHint = 0` to instruct Chromium renderer to disable receiver jitter buffering where supported.

3. **OBS Hardware Acceleration & Audio Settings**:
   - Provide recommended OBS Browser Source settings in documentation (`--enable-gpu`, `--ignore-certificate-errors` for local certs if required).

## Consequences

### Positive
- **Ultra-low Latency**: Measured latency < 150ms over standard Wi-Fi 5 / Wi-Fi 6.
- **Negligible CPU Usage**: OBS processes raw video frames without CPU-heavy software decoding.
- **Clean Integration**: Seamless drag-and-drop URL copy into OBS Browser Source.

### Negative
- Local self-signed SSL certificates require OBS settings adjustments or system trust store installation.
