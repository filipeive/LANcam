# LANCam — Local Network Camera

> Turn your smartphone into a low-latency camera for OBS Studio over your local network. No internet required.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## What is LANCam?

LANCam transforms any smartphone into a professional video source for OBS Studio using WebRTC over your local network. It's designed for:

- **Churches & Events** — Use phones as additional camera angles
- **Conferences & Schools** — Quick camera setup with no extra hardware  
- **Small Studios** — Low-latency camera feeds without expensive equipment
- **Content Creators** — Mobile camera angles for streaming

### Key Features

- **LAN-First**: Works entirely on your local network — no internet required
- **Ultra-Low Latency**: Direct WebRTC P2P with `playoutDelayHint = 0` and SDP munging (< 100ms glass-to-glass)
- **Native Desktop App**: Dedicated Electron app for Linux and Windows with embedded server and system tray
- **OBS Ready**: Dedicated Browser Source URL for each camera
- **Multi-Camera**: Connect multiple smartphones simultaneously
- **Auto-Reconnect**: Resilient connections that recover from Wi-Fi drops
- **QR Code Join**: Scan and start — no IP addresses to type

## Architecture

```
SMARTPHONE                           COMPUTER
┌──────────────┐                   ┌──────────────┐
│   Chrome      │                   │  LANCam      │
│   Camera Page │ ═══ WebRTC P2P ══>│  Server      │
│   (Sender)    │     (video)       │  + Dashboard │
└──────────────┘                   └──────┬───────┘
                                          │
                        ┌─────────────────┘
                        │ signaling only
                        │ (WebSocket)
                        │
                   ┌────┴────┐
                   │  OBS    │
                   │ Browser │ <── receives WebRTC video
                   │ Source  │
                   └─────────┘
```

The LANCam server handles **signaling only** — no video passes through it. Video flows directly from your phone to OBS via WebRTC.

## Requirements

- **Node.js** 20 or higher
- **Computer**: Linux, macOS, or Windows
- **Smartphone**: Android (Chrome) or iOS (Safari)
- **OBS Studio** (for video production)
- **Local Network**: Both devices on the same Wi-Fi/LAN

## Quick Start

### 1. Install

```bash
git clone <your-repo-url> lancam
cd lancam
npm install
```

### 2. Setup HTTPS Certificates

Camera access requires HTTPS. Generate local certificates:

```bash
npm run setup:certs
```

This uses `mkcert` to create locally-trusted certificates.

### 3. Run Web App or Desktop App

**Web Server Mode**:
```bash
npm run dev
```

**Native Desktop App (Linux & Windows)**:
```bash
# Run Electron Desktop App in development
npm run dev:desktop

# Build Native Desktop Installers (.AppImage / .deb for Linux, .exe for Windows)
npm run package:desktop:linux
npm run package:desktop:win
```

### 4. Open Dashboard

Open the URL shown in the terminal on your computer browser:
```
https://192.168.1.xxx:3478
```

### 5. Create a Session

Enter a session name (e.g., "Sunday Service") and click **Create Session**.

### 6. Connect Your Phone

Scan the QR code with your smartphone. The camera page will open automatically.

### 7. Start Streaming

1. Select your camera (front/back)
2. Choose resolution (720p, 1080p, etc.)
3. Press **START CAMERA**

### 8. Add to OBS

1. In OBS: Sources → **+** → **Browser**
2. Paste the OBS URL from the dashboard
3. Set resolution to match your camera (e.g., 1920×1080)
4. Video appears!

## Development

### Project Structure

```
lancam/
├── apps/
│   ├── server/          # Node.js signaling server
│   └── web/             # Frontend (Vite + TypeScript)
├── packages/
│   └── shared/          # Shared types & constants
├── scripts/             # Setup & deployment scripts
├── certs/               # Generated certificates (gitignored)
├── docs/                # Documentation
└── tests/               # Tests
```

### Commands

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm test` | Run tests |
| `npm run setup:certs` | Generate HTTPS certificates |

### Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|---|---|---|
| `APP_PORT` | `3478` | Server port |
| `APP_HOST` | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | `info` | Logging level |
| `SESSION_TTL_HOURS` | `24` | Session expiry |

## Smartphone Setup

### Android (Chrome)

1. Install the root CA certificate on your phone (see `npm run setup:certs` output)
2. Open the QR code URL in Chrome
3. Allow camera access when prompted
4. **Keep the app in the foreground** — switching apps will pause the camera

### iOS (Safari)

1. Install the root CA profile in Settings
2. Enable full trust for the certificate
3. Open the QR code URL in Safari

## OBS Setup

### Browser Source Settings

| Setting | Value |
|---|---|
| **URL** | Copy from LANCam dashboard |
| **Width** | Match your camera resolution (e.g., 1920) |
| **Height** | Match your camera resolution (e.g., 1080) |
| **FPS** | 30 |
| **Custom CSS** | *(leave default)* |
| **Shutdown source when not visible** | ❌ Unchecked |
| **Refresh browser when scene becomes active** | ✅ Checked |

### Troubleshooting OBS

- **Black screen**: Right-click source → Interact → Check if there's a connection error
- **No video after reconnect**: Right-click source → Refresh cache
- **Audio issues**: OBS Browser Sources may need "Control audio via OBS" enabled

## Network Requirements

- Both devices must be on the **same local network**
- **5 GHz Wi-Fi recommended** for 1080p streaming
- Minimum bandwidth: ~5 Mbps per camera
- No internet connection required

## Security

- Session tokens are cryptographically random
- Camera/session IDs are unpredictable
- All communication is over HTTPS/WSS
- Tokens expire with sessions
- No data leaves your local network

## Roadmap

- [x] **Phase 1**: Single camera → OBS
- [ ] **Phase 2**: Multi-camera support
- [ ] **Phase 3**: Advanced diagnostics dashboard
- [ ] **Phase 4**: mDNS discovery (lancam.local)
- [ ] **Phase 5**: Optional cloud mode
- [ ] **Phase 6**: Remote production
- [ ] **Phase 7**: Native Android app

## License

MIT
