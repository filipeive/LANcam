# ADR-006: WebRTC Latency & Stabilization Tuning

## Status
**Accepted**

## Date
2026-09-24

## Context
Initial WebRTC video streaming over LAN experienced occasional frame stuttering, playout delays, and stream buffering when bandwidth or CPU load fluctuated on mobile cameras or OBS Browser Source.

## Decision
Implement a multi-layered stabilization and low-latency pipeline in `apps/web/src/lib/webrtc.ts` and `apps/web/src/pages/viewer/viewer.ts`:

1. **Receiver Playout Delay Reduction (`playoutDelayHint = 0`)**:
   Force `RTCRtpReceiver.playoutDelayHint = 0` on incoming video tracks to bypass Chromium's dynamic jitter buffer.

2. **Degradation Preference Shift**:
   Configure RTCRtpSender to use `degradationPreference = 'maintain-framerate'`, keeping smooth 30/60 FPS streaming during network fluctuations.

3. **Hardware Acceleration & SDP Munging**:
   Reorder SDP codecs to prefer hardware-accelerated H.264 (Constrained Baseline/Main) and VP8. Inject Google low-latency bitrate parameters (`x-google-min-bitrate`, `x-google-start-bitrate`, `x-google-max-bitrate`).

4. **Dynamic Adaptive Bitrate Management**:
   Monitor network RTT and packet loss via `StatsCollector`. If high latency (>150ms) or dropped packets occur, automatically adjust encoding parameters to prevent buffer bloat.

## Consequences
- Sub-100ms glass-to-glass latency over LAN.
- Smooth video playback without accumulated latency or frozen frames.
- Consistent performance across high-end and budget Android/iOS mobile devices.
