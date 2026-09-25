import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '../session.js';
import { createSessionId, createSessionToken, createViewerId, createCameraId } from '../security.js';

test('Security Helpers', () => {
  const sessionId = createSessionId();
  assert.equal(typeof sessionId, 'string');
  assert.equal(sessionId.length, 16);

  const token = createSessionToken();
  assert.equal(typeof token, 'string');
  assert.equal(token.length, 32);

  const viewerId = createViewerId();
  assert.ok(viewerId.startsWith('VWR-'));

  const cameraId = createCameraId();
  assert.ok(cameraId.startsWith('CAM-'));
});

test('SessionManager lifecycle', () => {
  const sessionManager = new SessionManager();

  // Create session
  const sessionRes = sessionManager.createSession('Test Main Studio');
  assert.ok(sessionRes.sessionId);
  assert.ok(sessionRes.joinToken);
  assert.ok(sessionRes.joinCode);

  // Retrieve session info
  const sessionInfo = sessionManager.getSession(sessionRes.sessionId);
  assert.ok(sessionInfo);
  assert.equal(sessionInfo?.sessionName, 'Test Main Studio');
  assert.equal(sessionInfo?.state, 'created');

  // Join session via code
  const joinRes = sessionManager.joinSession(sessionRes.joinCode);
  assert.ok(joinRes);
  assert.equal(joinRes?.sessionName, 'Test Main Studio');
  assert.ok(joinRes?.cameraId.startsWith('CAM-'));

  // Register camera details
  const registered = sessionManager.registerCamera(
    sessionRes.sessionId,
    joinRes!.cameraId,
    'Phone 1'
  );
  assert.equal(registered, true);

  // Update status
  sessionManager.updateCameraStatus(sessionRes.sessionId, joinRes!.cameraId, 'live');
  const updatedSession = sessionManager.getSession(sessionRes.sessionId);
  assert.equal(updatedSession?.cameras[0].status, 'live');

  // Remove camera
  sessionManager.removeCamera(sessionRes.sessionId, joinRes!.cameraId);
  const sessionAfterRemove = sessionManager.getSession(sessionRes.sessionId);
  assert.equal(sessionAfterRemove?.cameras.length, 0);

  // End session
  sessionManager.endSession(sessionRes.sessionId);
  const endedSession = sessionManager.getSession(sessionRes.sessionId);
  assert.equal(endedSession?.state, 'ended');
});
