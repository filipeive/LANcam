# Gerando Instaladores do LANCam (Windows, Linux e Android)

Este guia descreve como gerar os instaladores e pacotes executáveis do LANCam para **Linux**, **Windows** e **Android**.

---

## 🛠️ Pré-requisitos

Certifique-se de ter as dependências do projeto instaladas:

```bash
npm install
npm run build
```

---

## 🐧 Linux (AppImage & .deb)

Para gerar os pacotes Linux:

```bash
npm run package:linux
```

### Arquivos Gerados
Os artefatos são salvos em `apps/desktop/dist-package/`:
- `LANCam-0.1.0-linux.AppImage` (Executável portátil para qualquer distribuição Linux)
- `LANCam-0.1.0-linux.deb` (Pacote de instalação para Debian / Ubuntu / Mint)

---

## 🪟 Windows (.exe NSIS & Portable)

Para gerar o instalador e o executável portátil para Windows:

```bash
npm run package:win
```

### Arquivos Gerados
Os artefatos são salvos em `apps/desktop/dist-package/`:
- `LANCam-0.1.0-win.exe` (Instalador NSIS para Windows com suporte a atalhos e desinstalação)
- `LANCam-0.1.0-win-portable.exe` (Executável standalone sem necessidade de instalação)

> **Nota para compilação no Linux**: O `electron-builder` utiliza o `wine` (já instalado no sistema) para empacotar o executável do Windows.

---

## 📱 Android (PWA / APK)

Para gerar o pacote web para Android e instruções de compilação APK:

```bash
npm run package:android
```

### Formatos Disponíveis

1. **Instalação Direta via PWA (Recomendado)**:
   - Abra `https://<ip-do-servidor>:3478` no Chrome do smartphone Android.
   - Toque no menu do Chrome (⋮) e selecione **Adicionar à tela de início** / **Instalar aplicativo**.
   - O aplicativo funcionará em modo tela cheia, como um app nativo.

2. **Geração de APK Nativo via Capacitor**:
   - Adicione a plataforma Android: `npx cap add android`
   - Abra no Android Studio: `npx cap open android`
   - No Android Studio: **Build** → **Build APK**.

3. **Geração de APK via Bubblewrap (TWA)**:
   - Execute: `npx @bubblewrap/cli build`

---

## 🚀 Gerar Todos os Instaladores

Para compilar e empacotar todas as plataformas de uma só vez:

```bash
npm run package:all
```
