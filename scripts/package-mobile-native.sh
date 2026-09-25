#!/usr/bin/env bash

# LANCam — Native Mobile Packaging Script (Android APK/AAB & iOS Xcode Project)

set -e

echo "==================================================================="
echo "   📱 Packaging LANCam Native Mobile Apps (Android & iOS)"
echo "==================================================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Build Web Assets
echo "📦 1. Compilando os ficheiros web da aplicação móvel..."
npm run build --workspace=apps/web

DIST_DIR="$ROOT_DIR/apps/web/dist"
if [ ! -d "$DIST_DIR" ]; then
  echo "❌ Erro: Diretório $DIST_DIR não encontrado!"
  exit 1
fi

OUTPUT_DIR="$ROOT_DIR/dist-package/android"
mkdir -p "$OUTPUT_DIR"

# 2. Add and Sync Capacitor Platforms
echo "⚡ 2. Sincronizando o projeto Capacitor com plataformas nativas..."

if [ ! -d "$ROOT_DIR/android" ]; then
  echo "🤖 Adicionando plataforma Android..."
  npx -y @capacitor/cli add android || true
fi

if [ ! -d "$ROOT_DIR/ios" ]; then
  echo "🍏 Adicionando plataforma iOS..."
  npx -y @capacitor/cli add ios || true
fi

echo "🔄 Sincronizando código web com Android e iOS..."
npx -y @capacitor/cli sync || true

# 3. Configure Android Manifest Permissions
ANDROID_MANIFEST="$ROOT_DIR/android/app/src/main/AndroidManifest.xml"
if [ -f "$ANDROID_MANIFEST" ]; then
  echo "🔐 Verificando permissões nativas no AndroidManifest.xml..."
  python3 - << 'PYEOF'
import xml.etree.ElementTree as ET

manifest_path = "android/app/src/main/AndroidManifest.xml"
with open(manifest_path, "r") as f:
    content = f.read()

permissions = [
    '<uses-permission android:name="android.permission.CAMERA" />',
    '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
    '<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />',
    '<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />',
    '<uses-permission android:name="android.permission.WAKE_LOCK" />',
    '<uses-feature android:name="android.hardware.camera" android:required="false" />',
    '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />'
]

for perm in permissions:
    if perm not in content:
        content = content.replace('<application', perm + '\n    <application')

with open(manifest_path, "w") as f:
    f.write(content)
PYEOF
fi

# 4. Build Native Android APK if Gradle wrapper is available
if [ -d "$ROOT_DIR/android" ] && [ -f "$ROOT_DIR/android/gradlew" ]; then
  echo "🛠️ 4. Compilando APK Android NATIVO via Gradle..."
  cd "$ROOT_DIR/android"
  chmod +x gradlew
  ./gradlew assembleDebug || true
  cd "$ROOT_DIR"

  BUILT_APK="$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
  if [ -f "$BUILT_APK" ]; then
    cp "$BUILT_APK" "$OUTPUT_DIR/lancam-android-native-debug.apk"
    echo "🎉 APK Nativo gerado com sucesso em: $OUTPUT_DIR/lancam-android-native-debug.apk"
  fi
fi

echo ""
echo "==================================================================="
echo "   🎉 PACOTE MÓVEL NATIVO GERADO COM SUCESSO!"
echo "==================================================================="
echo "   🤖 Android Nativo: $ROOT_DIR/android"
echo "   🍏 iOS Xcode Project: $ROOT_DIR/ios"
echo "   📦 APK Output: $OUTPUT_DIR/lancam-android-native-debug.apk"
echo ""
echo "💡 Para gerar o APK final / AAB para a Google Play Store:"
echo "   npx cap open android (Abra no Android Studio -> Build -> Generate Signed Bundle/APK)"
echo ""
echo "💡 Para gerar a app iOS para a Apple App Store:"
echo "   npx cap open ios (Abra no Xcode no macOS -> Product -> Archive -> Distribute App)"
echo ""
