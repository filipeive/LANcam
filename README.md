# LANCam — Local Network Camera

> Transform your smartphone into an ultra-low latency camera for OBS Studio over your local network or cloud server. No complex hardware required.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node.js](https://img.shields.io/badge/node.js-%3E%3D20.0.0-brightgreen)
![Electron](https://img.shields.io/badge/electron-31.3.0-blue)

---

## 👨‍💻 Developer & Author

- **Developer**: Filipe dos Santos
- **GitHub Profile**: [@filipeive](https://github.com/filipeive)
- **Repository**: [https://github.com/filipeive/LANcam](https://github.com/filipeive/LANcam)
- **Server Production URL**: [http://146.235.224.99](http://146.235.224.99)

---

## 📷 What is LANCam?

LANCam transforms any smartphone (Android / iOS) into a high-performance, low-latency wireless camera feed directly into **OBS Studio** using WebRTC P2P technology.

### Key Features

- ⚡ **Ultra-Low Latency**: Direct WebRTC peer-to-peer streaming with `playoutDelayHint = 0` (< 100ms glass-to-glass latency).
- 🖥️ **Cross-Platform Desktop App**: Native Electron app for Linux (AppImage / `.deb`) and Windows (`.exe` NSIS / Portable) with system tray integration.
- 📱 **Mobile Ready (Android & iOS)**: Responsive PWA interface, background lock prevention, camera switching (front/back), and resolution selection.
- 🎬 **OBS Studio Ready**: Automatic HTTP/HTTPS Browser Source URLs generated for instant OBS integration.
- 👥 **Multi-Camera Sessions**: Connect multiple smartphones simultaneously to a single broadcast dashboard.
- 📱 **QR Code Quick Join**: Scan and connect smartphones instantly without typing IP addresses.
- ☁️ **Cloud & LAN Deployable**: Automated 1-click deployment script for Linux/Oracle Cloud production servers.

---

## 🏗️ Architecture

```
SMARTPHONE                           COMPUTER / OBS
┌──────────────┐                   ┌──────────────┐
│  Mobile Web  │                   │  LANCam      │
│  Camera Page │ ═══ WebRTC P2P ══>│  Dashboard   │
│  (Sender)    │    (Direct Video) │  + Server    │
└──────────────┘                   └──────┬───────┘
                                          │
                        ┌─────────────────┘
                        │ signaling only (WebSocket)
                        │
                   ┌────┴────┐
                   │  OBS    │
                   │ Browser │ <── receives WebRTC video stream
                   │ Source  │
                   └─────────┘
```

---

## 🛠️ Quick Start & Installation

### 1. Clone & Install Dependencies

```bash
git clone git@github.com:filipeive/LANcam.git lancam
cd lancam
npm install
```

### 2. HTTPS Setup (Required for Camera Access)

Generating locally trusted SSL certificates:

```bash
npm run setup:certs
```

### 3. Running in Development

- **Server + Web App**: `npm run dev`
- **Desktop App (Electron)**: `npm run dev:desktop`
- **All Combined**: `npm run dev:all`

---

## 📦 Building Installers (Windows, Linux & Android)

| Target Platform | Command | Generated Output Path |
|---|---|---|
| 🐧 **Linux** (`.AppImage` & `.deb`) | `npm run package:linux` | `apps/desktop/dist-package/LANCam-0.1.0-linux.AppImage`<br>`apps/desktop/dist-package/LANCam-0.1.0-linux.deb` |
| 🪟 **Windows** (`.exe` NSIS & Portable) | `npm run package:win` | `apps/desktop/dist-package/LANCam-0.1.0-win.exe` |
| 📱 **Android** (PWA Bundle / APK guide) | `npm run package:android` | `dist-package/android/lancam-android-web-pwa.zip` |
| 🚀 **All Platforms** | `npm run package:all` | Packages Linux, Windows, and Android all at once |

Detailed instructions are available in [docs/BUILDING_INSTALLERS.md](docs/BUILDING_INSTALLERS.md).

---

## 🚀 Production Deployment

Deploy LANCam automatically to your production server (e.g. Oracle Cloud VPS):

```bash
./deploy-lancam.sh
```

This script handles:
- Code pull & workspace compilation
- PM2 process daemon management
- Nginx reverse proxy & WebSocket (`/ws`) configuration

---

## 🗺️ Roadmap & Progress

- [x] **Phase 1**: Core WebRTC P2P streaming (Phone → OBS Browser Source)
- [x] **Phase 2**: Multi-camera support & dynamic session management
- [x] **Phase 3**: Cross-platform Desktop App & Native Installers (Linux AppImage/DEB, Windows NSIS EXE, Android PWA)
- [x] **Phase 4**: Production Cloud Deployment (Automated Oracle Cloud Nginx + PM2 script)
- [x] **Phase 5**: QR Code Join & Low-latency WebRTC Optimization
- [ ] **Phase 6**: mDNS Local Discovery (`lancam.local`)
- [ ] **Phase 7**: Native Mobile App Releases (Google Play Store & Apple App Store)

---

## 📄 License

MIT © [Filipe dos Santos](https://github.com/filipeive)
