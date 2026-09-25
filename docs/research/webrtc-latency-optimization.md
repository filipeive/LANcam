# WebRTC Latency Stabilization & Low Latency Optimization Research

## Abstract
This document outlines technical research, root-cause analysis, and optimization strategies for eliminating video stream lag, jitter buffer delays, and frame drops in **LANCam** over Local Area Networks (LAN).

---

## 1. Root Causes of WebRTC Video Lag in Browser-Based Camera Streaming

### A. Receiver Playout Delay (Jitter Buffering)
Chromium (the underlying engine of Chrome, Edge, and OBS Browser Source) defaults to a dynamic jitter buffer designed for internet conferencing (often holding 150ms–500ms of video frames). In local network (LAN) scenarios with high bandwidth and low latency (<5ms RTT), this buffer introduces artificial lag.

**Solution**: Set `playoutDelayHint = 0` on `RTCRtpReceiver` tracks. This instructs Chromium to render received frames immediately without holding them in the jitter buffer.

### B. Sub-optimal Degradation Preference
Setting `degradationPreference = 'maintain-resolution'` forces WebRTC to maintain video frame width/height during minor Wi-Fi drops or CPU contention. This causes WebRTC to drop framerate drastically or queue frames, resulting in severe video freeze, stuttering, and accumulated buffer delay.

**Solution**: Set `degradationPreference = 'maintain-framerate'` or `'balanced'`. In broadcast scenarios (OBS), smooth 30/60 FPS with minor resolution scaling is far superior to stuttering high-resolution frozen frames.

### C. Software Codec CPU Bottlenecks (VP9 / AV1)
Browsers may negotiate CPU-intensive software codecs like VP9 or AV1 when initializing RTCPeerConnection SDP. On mobile devices (Android/iOS) and OBS Browser Source, software encoding/decoding burns CPU, leading to thermal throttling and frame drops.

**Solution**: Enforce H.264 (Constrained Baseline / Main profile) or VP8 in WebRTC SDP negotiation. H.264 offers ubiquitous hardware acceleration on virtually all modern smartphones and desktop GPUs.

### D. SDP Bitrate Warmup Delays
Standard WebRTC starts streaming at conservative bitrates (~300 Kbps) and gradually ramps up over 5–10 seconds. In LAN broadcast environments, this warmup period causes initial resolution drops and rate-control lag.

**Solution**: Munge SDP lines to specify explicit bitrate targets (`b=AS`, `x-google-min-bitrate`, `x-google-start-bitrate`).

---

## 2. Technical Implementation Summary

1. **RTCRtpReceiver playoutDelayHint**:
   ```typescript
   if ('playoutDelayHint' in receiver) {
     receiver.playoutDelayHint = 0;
   }
   ```

2. **RTCRtpSender parameters**:
   ```typescript
   const params = sender.getParameters();
   params.degradationPreference = 'maintain-framerate';
   params.encodings[0].maxBitrate = targetBitrate;
   await sender.setParameters(params);
   ```

3. **SDP Munging for H.264 Codec Priority & Bitrate**:
   - Prioritize `H264/90000` payload types in `m=video` lines.
   - Inject `x-google-min-bitrate`, `x-google-start-bitrate`, `x-google-max-bitrate` into fmtp lines.

4. **Electron Native Packaging**:
   - Provide zero-config native Desktop Applications for Linux (`.AppImage`, `.deb`) and Windows (`.exe` installer / portable).
   - Embedded signaling server and local IP discovery in a native desktop interface.
