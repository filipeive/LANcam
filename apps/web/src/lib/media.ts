/**
 * LANCam — Media Utilities
 *
 * Camera enumeration, capability detection, and constraint building.
 * Wraps browser MediaDevices API with error handling.
 */

import type { Resolution, VideoPreset } from '@lancam/shared';
import { VIDEO_PRESETS } from '@lancam/shared';

export interface DeviceInfo {
  deviceId: string;
  label: string;
  facingMode: string;
}

/**
 * Request camera permission and enumerate video devices.
 * Must request getUserMedia first to get device labels.
 */
export async function enumerateVideoDevices(): Promise<DeviceInfo[]> {
  // First request permission to get device labels
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch (err) {
    throw new CameraError('PERMISSION_DENIED', 'Camera permission denied', err);
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter((d) => d.kind === 'videoinput');

  if (videoDevices.length === 0) {
    throw new CameraError('NO_CAMERA', 'No camera found on this device');
  }

  return videoDevices.map((d) => ({
    deviceId: d.deviceId,
    label: d.label || `Camera ${d.deviceId.slice(0, 6)}`,
    facingMode: d.label.toLowerCase().includes('front') ? 'user' : 'environment',
  }));
}

/**
 * Detect supported resolutions for a specific camera.
 * Tests each preset and returns those that work.
 */
export async function detectSupportedPresets(deviceId: string): Promise<VideoPreset[]> {
  const allPresets = Object.values(VIDEO_PRESETS);
  const supported: VideoPreset[] = [];

  // 1. Try track capabilities API if available (instant & single-shot)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
    });
    const track = stream.getVideoTracks()[0];
    const capabilities = typeof track.getCapabilities === 'function' ? track.getCapabilities() : null;
    track.stop();

    if (capabilities && (capabilities.width || capabilities.height)) {
      const maxDim = Math.max(capabilities.width?.max || 0, capabilities.height?.max || 0);

      for (const preset of allPresets) {
        const targetMax = Math.max(preset.width, preset.height);
        if (maxDim >= targetMax * 0.85) {
          supported.push(preset);
        }
      }

      if (supported.length > 0) {
        return supported;
      }
    }
  } catch {
    // Capability check failed or not supported — proceed to stream tests
  }

  // 2. Fallback stream testing loop with orientation-independent dimension checking
  for (const preset of allPresets) {
    try {
      const targetMax = Math.max(preset.width, preset.height);
      const targetMin = Math.min(preset.width, preset.height);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: targetMax },
          height: { ideal: targetMin },
          frameRate: { ideal: preset.frameRate },
        },
      });

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      track.stop();

      const actualWidth = settings.width || 0;
      const actualHeight = settings.height || 0;
      const actualMax = Math.max(actualWidth, actualHeight);

      // Accept if actual max dimension reaches at least 85% of target max
      if (actualMax >= targetMax * 0.85) {
        supported.push(preset);
      }
    } catch {
      // Preset test failed — continue
    }
  }

  // 3. Robust fallback: Return all standard presets if detection yielded none
  if (supported.length === 0) {
    return allPresets;
  }

  return supported;
}

/**
 * Get a camera stream with specific constraints.
 */
export async function getCameraStream(
  deviceId: string,
  preset: VideoPreset,
  withAudio = false,
): Promise<MediaStream> {
  const targetMax = Math.max(preset.width, preset.height);
  const targetMin = Math.min(preset.width, preset.height);

  // Adapt ideal dimensions to current screen / device orientation
  const isPortrait = window.innerHeight > window.innerWidth;
  const idealWidth = isPortrait ? targetMin : targetMax;
  const idealHeight = isPortrait ? targetMax : targetMin;

  const videoConstraints: MediaTrackConstraints = {
    width: { ideal: idealWidth },
    height: { ideal: idealHeight },
    frameRate: { ideal: preset.frameRate },
  };

  if (deviceId) {
    videoConstraints.deviceId = { exact: deviceId };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: withAudio ? { echoCancellation: true, noiseSuppression: true } : false,
    });

    return stream;
  } catch (err) {
    // If exact deviceId constraint fails on some mobile devices, retry with ideal deviceId constraint
    if (deviceId && err instanceof DOMException && err.name === 'OverconstrainedError') {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { ideal: deviceId },
            width: { ideal: idealWidth },
            height: { ideal: idealHeight },
            frameRate: { ideal: preset.frameRate },
          },
          audio: withAudio ? { echoCancellation: true, noiseSuppression: true } : false,
        });
        return fallbackStream;
      } catch {
        // Fallback failed — throw original error below
      }
    }

    if (err instanceof DOMException) {
      switch (err.name) {
        case 'NotAllowedError':
          throw new CameraError('PERMISSION_DENIED', 'Camera permission denied', err);
        case 'NotFoundError':
          throw new CameraError('NOT_FOUND', 'Camera not found', err);
        case 'NotReadableError':
          throw new CameraError('IN_USE', 'Camera is being used by another application', err);
        case 'OverconstrainedError':
          throw new CameraError('UNSUPPORTED', 'Requested resolution is not supported', err);
        default:
          throw new CameraError('UNKNOWN', `Camera error: ${err.message}`, err);
      }
    }
    throw new CameraError('UNKNOWN', 'Failed to access camera', err);
  }
}

/**
 * Toggle flashlight/torch on a video track.
 */
export async function setTorch(track: MediaStreamTrack, enable: boolean): Promise<boolean> {
  try {
    await track.applyConstraints({
      advanced: [{ torch: enable } as any],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get actual camera capabilities (zoom, torch, etc.)
 */
export function getCameraCapabilities(track: MediaStreamTrack): {
  hasZoom: boolean;
  hasTorch: boolean;
  hasFocus: boolean;
} {
  try {
    const capabilities = track.getCapabilities?.() as Record<string, unknown> | undefined;

    return {
      hasZoom: !!capabilities?.zoom,
      hasTorch: !!capabilities?.torch,
      hasFocus: !!capabilities?.focusMode,
    };
  } catch {
    return { hasZoom: false, hasTorch: false, hasFocus: false };
  }
}

/**
 * Request the Screen Wake Lock to keep the phone awake during streaming.
 */
export async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  try {
    if ('wakeLock' in navigator) {
      const sentinel = await navigator.wakeLock.request('screen');
      console.log('[Media] Wake lock acquired');
      return sentinel;
    }
  } catch (err) {
    console.warn('[Media] Wake lock failed:', err);
  }
  return null;
}

// ─── Error Types ───────────────────────────────────────────────

export type CameraErrorCode =
  | 'PERMISSION_DENIED'
  | 'NO_CAMERA'
  | 'NOT_FOUND'
  | 'IN_USE'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

export class CameraError extends Error {
  constructor(
    public code: CameraErrorCode,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = 'CameraError';
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'PERMISSION_DENIED':
        return 'Camera permission was denied. Please allow camera access in your browser settings and reload.';
      case 'NO_CAMERA':
        return 'No camera found on this device.';
      case 'NOT_FOUND':
        return 'The selected camera is no longer available.';
      case 'IN_USE':
        return 'Camera is being used by another application. Please close other camera apps and try again.';
      case 'UNSUPPORTED':
        return 'The requested camera settings are not supported by this device.';
      default:
        return 'An unexpected error occurred with the camera. Please try again.';
    }
  }
}
