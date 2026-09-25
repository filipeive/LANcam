# LANCam Troubleshooting & FAQ

Common issues and solutions for running LANCam on local networks.

---

## 1. Camera Access Issues (Mobile Browser)

### Problem: "Camera Access Denied" or `getUserMedia` fails
- **Cause**: Mobile browser is accessing the site over plain `http://` or camera permission was refused.
- **Solution**:
  1. Mobile browsers enforce a **Secure Context** (HTTPS or localhost). Ensure you are using `https://<IP>:3478`.
  2. Clear site permissions in mobile browser settings (Safari / Chrome) and reload.
  3. Ensure no other application (like Native Camera app) is locking the camera hardware exclusively.

### Problem: Browser shows SSL certificate warning ("Not Secure")
- **Cause**: Self-signed certificate generated for local IP address.
- **Solution**:
  - Tap **Advanced** -> **Proceed to IP (unsafe)** on iOS/Android.
  - Or install `mkcert` root CA certificate onto mobile device profile.

---

## 2. WebRTC Connection Issues

### Problem: Stream stuck on "Connecting..." in OBS or Viewer
- **Cause**: Local firewall blocking WebRTC UDP/TCP traffic or peers on isolated subnets.
- **Solution**:
  1. Verify smartphone and PC are on the **same Wi-Fi router / subnet**.
  2. Disable AP Isolation (Client Isolation) on Wi-Fi router.
  3. Allow port `3478` (TCP/UDP) and dynamic WebRTC ports in Host Firewall (ufw / Windows Firewall).

---

## 3. Latency or Stuttering Video

### Problem: Video drops frames or lags behind real-time
- **Cause**: High Wi-Fi latency, 2.4 GHz interference, or excessive video resolution/bitrate.
- **Solution**:
  1. Switch Wi-Fi router to **5 GHz**.
  2. On Camera screen, lower preset from **1080p60** to **720p (BALANCED)**.
  3. Keep smartphone plugged into power to prevent thermal throttling or battery saver mode.
  4. Enable **Screen Wake Lock** (automatically handled in LANCam UI) so phone screen stays active.

---

## 4. Diagnostics & Logs

- **Server Logs**: Inspect stdout/stderr logs on the server terminal or set `LOG_LEVEL=debug` in `.env`.
- **WebRTC Stats**: Open Dashboard at `/dashboard` to monitor active bitrates, round-trip time (RTT), and packet loss in real time.
