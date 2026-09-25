# ADR-001: Architecture — Custom Signaling Server + WebRTC P2P

## Status
**Accepted**

## Date
2026-09-19

## Context

LANCam needs to stream video from smartphone cameras to OBS Studio over a local network with minimal latency. Three architectural approaches were evaluated:

1. **Option A**: Pure WebRTC P2P with custom signaling
2. **Option B**: WebRTC + MediaMTX media server (WHIP/WHEP)
3. **Option C**: Custom signaling server + WebRTC P2P (hybrid of A with structured session management)

The system must work **entirely offline** on a LAN, support 1-4 cameras, and deliver sub-200ms glass-to-glass latency.

## Decision

**Option C — Custom Signaling Server + WebRTC P2P**

A single Node.js process handles:
- HTTP/HTTPS server (Express) for the web application and REST API
- WebSocket signaling server for SDP/ICE exchange
- Session management (in-memory)

Video flows **directly** from the phone browser to the OBS Browser Source via WebRTC peer-to-peer — the server never touches media data.

## Alternatives Considered

### MediaMTX (Option B)
- **Pro**: Built-in WHIP/WHEP, handles fan-out, battle-tested media relay
- **Con**: External Go binary dependency, requires Docker or manual installation, adds relay latency (~5-15ms), consumes server CPU for media forwarding, overkill for ≤4 cameras with 1 OBS viewer
- **Verdict**: Excellent choice for Phase 5+ when fan-out scaling is needed

### VDO.Ninja-style
- **Pro**: Proven architecture, open source reference
- **Con**: Depends on external signaling/TURN servers, not LAN-first by design

## Trade-offs

| Aspect | Chosen Approach | Alternative (MediaMTX) |
|---|---|---|
| Latency | ⭐ Direct P2P — lowest possible | Relay adds 5-15ms |
| Server CPU | ⭐ Zero media processing | Transcoding/forwarding cost |
| Installation | ⭐ Single `npm install` | External binary required |
| Multi-viewer | ❌ N connections per camera | ⭐ Built-in fan-out |
| Complexity | Medium (custom WebRTC code) | Lower (delegated to MediaMTX) |

## Consequences

1. Each OBS viewer opens a direct WebRTC connection to the camera phone
2. For 4 cameras × 1 OBS viewer = 4 P2P connections (trivial for LAN)
3. If multi-viewer scaling is needed later, MediaMTX can be introduced as the media plane without changing the signaling protocol
4. The signaling protocol is designed to be compatible with future MediaMTX WHIP/WHEP integration
