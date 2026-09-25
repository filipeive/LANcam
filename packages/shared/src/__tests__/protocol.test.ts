import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_NAME,
  APP_VERSION,
  DEFAULT_PORT,
  VIDEO_PRESETS,
  CAMERA_ID_PREFIX,
  SESSION_NAME_MAX_LENGTH,
} from '../index.js';

test('Shared Constants', () => {
  assert.equal(APP_NAME, 'LANCam');
  assert.equal(APP_VERSION, '0.1.0');
  assert.equal(DEFAULT_PORT, 3478);
  assert.equal(CAMERA_ID_PREFIX, 'CAM-');
  assert.equal(SESSION_NAME_MAX_LENGTH, 100);
});

test('Video Presets validation', () => {
  assert.ok(VIDEO_PRESETS.LOW);
  assert.ok(VIDEO_PRESETS.BALANCED);
  assert.ok(VIDEO_PRESETS.HIGH);
  assert.equal(VIDEO_PRESETS.LOW.width, 640);
  assert.equal(VIDEO_PRESETS.BALANCED.width, 1280);
  assert.equal(VIDEO_PRESETS.HIGH.width, 1920);
});
