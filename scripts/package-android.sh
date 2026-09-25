#!/usr/bin/env bash

# LANCam — Android Package Script
# Generates Android PWA / Web APK artifacts

set -e

echo "📱 Packaging LANCam for Android..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Build Web App
echo "📦 Building web app assets..."
npm run build --workspace=apps/web

# 2. Verify dist directory
DIST_DIR="$ROOT_DIR/apps/web/dist"
if [ ! -d "$DIST_DIR" ]; then
  echo "❌ Error: Web build dist directory not found at $DIST_DIR"
  exit 1
fi

# 3. Create Android package output directory
OUTPUT_DIR="$ROOT_DIR/dist-package/android"
mkdir -p "$OUTPUT_DIR"

# 4. Create PWA / Web Android Package zip
echo "⚡ Bundling Android PWA package..."
(cd "$DIST_DIR" && zip -r "$OUTPUT_DIR/lancam-android-web-pwa.zip" .)

# 5. Check if Capacitor is present
if npx cap --version &>/dev/null; then
  echo "🤖 Capacitor detected. Syncing Android project..."
  npx cap sync android || true
fi

echo ""
echo "✅ Android web package generated successfully:"
echo "   📂 Package Location: $OUTPUT_DIR/lancam-android-web-pwa.zip"
echo ""
echo "💡 To generate a native Android APK (.apk):"
echo "   1. Capacitor: npx cap add android && npx cap open android (Build APK in Android Studio)"
echo "   2. Bubblewrap (TWA): npx @bubblewrap/cli build"
echo "   3. PWA: Open https://<server-ip>:3478 on Android Chrome -> Tap 'Add to Home Screen' / Install App"
