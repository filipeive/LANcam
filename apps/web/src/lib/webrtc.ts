/**
 * LANCam — WebRTC Connection Manager
 *
 * Manages RTCPeerConnection lifecycle for both camera (sender)
 * and viewer (receiver) roles with ultra-low latency & stabilization tuning.
 */

import { LAN_ICE_CONFIG } from '@lancam/shared';
import type { ConnectionState } from '@lancam/shared';
import { SignalingClient } from './signaling-client.js';
import { StatsCollector, type StatsCallback } from './stats.js';

export type ConnectionStateHandler = (state: ConnectionState) => void;

interface WebRTCOptions {
  role: 'sender' | 'receiver';
  signaling: SignalingClient;
  peerId: string;
  remotePeerId: string;
  maxBitrate?: number;
  onStateChange: ConnectionStateHandler;
  onStats?: StatsCallback;
  onRemoteStream?: (stream: MediaStream) => void;
}

export class WebRTCConnection {
  private pc: RTCPeerConnection;
  private statsCollector: StatsCollector | null = null;
  private _state: ConnectionState = 'connecting';
  private iceCandidateBuffer: RTCIceCandidateInit[] = [];
  private hasRemoteDescription = false;
  private targetBitrate: number;

  private unsubscribers: Array<() => void> = [];

  constructor(private options: WebRTCOptions) {
    this.targetBitrate = options.maxBitrate || 4_500_000; // Default 4.5 Mbps
    this.pc = new RTCPeerConnection(LAN_ICE_CONFIG);
    this.setupEventHandlers();
    this.setupSignalingHandlers();

    if (options.onStats) {
      this.statsCollector = new StatsCollector(this.pc, options.onStats, options.role);
    }
  }

  /** Get the underlying RTCPeerConnection */
  get peerConnection(): RTCPeerConnection {
    return this.pc;
  }

  get state(): ConnectionState {
    return this._state;
  }

  /**
   * Add a local media stream (for sender/camera role).
   */
  addStream(stream: MediaStream): void {
    for (const track of stream.getTracks()) {
      const sender = this.pc.addTrack(track, stream);

      // Configure sender parameters for optimal frame stability and latency
      if (track.kind === 'video') {
        this.optimizeSenderParameters(sender, this.targetBitrate);
      }
    }
  }

  /**
   * Adjust max encoding bitrate dynamically (e.g., during network degradation).
   */
  async setMaxBitrate(bitrateBps: number): Promise<void> {
    this.targetBitrate = bitrateBps;
    for (const sender of this.pc.getSenders()) {
      if (sender.track?.kind === 'video') {
        await this.optimizeSenderParameters(sender, bitrateBps);
      }
    }
  }

  /**
   * Create and send an offer (for sender/camera role).
   */
  async createOffer(): Promise<void> {
    try {
      let offer = await this.pc.createOffer({
        offerToReceiveVideo: this.options.role === 'receiver',
      });

      const lowLatencySdp = optimizeSdpForLowLatency(offer.sdp || '', this.targetBitrate);
      offer = new RTCSessionDescription({ type: 'offer', sdp: lowLatencySdp });

      await this.pc.setLocalDescription(offer);

      this.options.signaling.send({
        type: 'offer',
        targetViewerId: this.options.remotePeerId,
        sdp: offer.sdp,
      });
    } catch (err) {
      console.error('[WebRTC] Failed to create offer:', err);
      this.setState('failed');
    }
  }

  /**
   * Handle a received offer and create an answer (for receiver/viewer role).
   */
  async handleOffer(sdp: string): Promise<void> {
    try {
      const lowLatencySdp = optimizeSdpForLowLatency(sdp, this.targetBitrate);
      await this.pc.setRemoteDescription({ type: 'offer', sdp: lowLatencySdp });
      this.hasRemoteDescription = true;
      await this.flushIceCandidates();

      let answer = await this.pc.createAnswer();
      const lowLatencyAnswerSdp = optimizeSdpForLowLatency(answer.sdp || '', this.targetBitrate);
      answer = new RTCSessionDescription({ type: 'answer', sdp: lowLatencyAnswerSdp });

      await this.pc.setLocalDescription(answer);

      this.options.signaling.send({
        type: 'answer',
        targetCameraId: this.options.remotePeerId,
        sdp: answer.sdp,
      });
    } catch (err) {
      console.error('[WebRTC] Failed to handle offer:', err);
      this.setState('failed');
    }
  }

  /**
   * Handle a received answer (for sender/camera role).
   */
  async handleAnswer(sdp: string): Promise<void> {
    try {
      const lowLatencySdp = optimizeSdpForLowLatency(sdp, this.targetBitrate);
      await this.pc.setRemoteDescription({ type: 'answer', sdp: lowLatencySdp });
      this.hasRemoteDescription = true;
      await this.flushIceCandidates();
    } catch (err) {
      console.error('[WebRTC] Failed to handle answer:', err);
      this.setState('failed');
    }
  }

  /**
   * Add an ICE candidate from the remote peer.
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.hasRemoteDescription) {
      // Buffer candidates until remote description is set
      this.iceCandidateBuffer.push(candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTC] Failed to add ICE candidate:', err);
    }
  }

  /**
   * Attempt ICE restart for reconnection.
   */
  async restartIce(): Promise<void> {
    try {
      this.setState('reconnecting');
      const offer = await this.pc.createOffer({ iceRestart: true });
      const lowLatencySdp = optimizeSdpForLowLatency(offer.sdp || '', this.targetBitrate);
      await this.pc.setLocalDescription({ type: 'offer', sdp: lowLatencySdp });

      this.options.signaling.send({
        type: 'offer',
        targetViewerId: this.options.remotePeerId,
        sdp: lowLatencySdp,
      });
    } catch (err) {
      console.error('[WebRTC] ICE restart failed:', err);
      this.setState('failed');
    }
  }

  /**
   * Close the connection and clean up.
   */
  close(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    this.statsCollector?.stop();

    if (this.pc.signalingState !== 'closed') {
      this.pc.close();
    }
    this.setState('disconnected');
  }

  // ─── Private Methods ───────────────────────────────────────

  private setupEventHandlers(): void {
    // ICE candidate generation
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.options.signaling.send({
          type: 'ice-candidate',
          targetId: this.options.remotePeerId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Connection state changes
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;

      switch (state) {
        case 'connecting':
          this.setState('connecting');
          break;
        case 'connected':
          this.setState('live');
          this.statsCollector?.start();
          break;
        case 'disconnected':
          this.setState('degraded');
          break;
        case 'failed':
          this.setState('failed');
          this.statsCollector?.stop();
          break;
        case 'closed':
          this.setState('disconnected');
          this.statsCollector?.stop();
          break;
      }
    };

    // ICE connection state (more granular than connectionState)
    this.pc.oniceconnectionstatechange = () => {
      const iceState = this.pc.iceConnectionState;
      if (iceState === 'disconnected' && this._state === 'live') {
        this.setState('degraded');
      }
      if (iceState === 'failed') {
        // Attempt ICE restart if we were previously connected
        if (this.options.role === 'sender') {
          this.restartIce();
        }
      }
    };

    // Incoming tracks (for receiver/viewer)
    this.pc.ontrack = (event) => {
      // Force zero playout delay on receiver tracks (bypasses dynamic jitter buffer delay)
      if (event.receiver) {
        if ('playoutDelayHint' in event.receiver) {
          (event.receiver as any).playoutDelayHint = 0;
        }
      }

      if (event.streams[0] && this.options.onRemoteStream) {
        this.options.onRemoteStream(event.streams[0]);
      }
    };
  }

  private setupSignalingHandlers(): void {
    // Handle incoming ICE candidates
    const unsubIce = this.options.signaling.on('ice-candidate', (msg) => {
      const iceMsg = msg as { from: string; candidate: RTCIceCandidateInit };
      if (iceMsg.from === this.options.remotePeerId) {
        this.addIceCandidate(iceMsg.candidate);
      }
    });
    this.unsubscribers.push(unsubIce);

    // Handle answer (for sender)
    if (this.options.role === 'sender') {
      const unsubAnswer = this.options.signaling.on('answer', (msg) => {
        const answerMsg = msg as { fromViewerId: string; sdp: string };
        if (answerMsg.fromViewerId === this.options.remotePeerId) {
          this.handleAnswer(answerMsg.sdp);
        }
      });
      this.unsubscribers.push(unsubAnswer);
    }
  }

  private async flushIceCandidates(): Promise<void> {
    for (const candidate of this.iceCandidateBuffer) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] Buffered ICE candidate failed:', err);
      }
    }
    this.iceCandidateBuffer = [];
  }

  private async optimizeSenderParameters(sender: RTCRtpSender, bitrateBps: number): Promise<void> {
    try {
      const params = sender.getParameters();
      if (params.encodings && params.encodings.length > 0) {
        params.encodings[0].maxBitrate = bitrateBps;
        // Prefer maintaining smooth framerate over resolution to eliminate frame stuttering
        params.degradationPreference = 'maintain-framerate';
        await sender.setParameters(params);
      }
    } catch (err) {
      console.warn('[WebRTC] Failed to optimize sender parameters:', err);
    }
  }

  private setState(state: ConnectionState): void {
    if (this._state !== state) {
      this._state = state;
      this.options.onStateChange(state);
    }
  }
}

/**
 * Utility to munge SDP for zero playout delay, hardware accelerated H.264 / VP8 preference,
 * and low-latency bitrate initialization.
 */
export function optimizeSdpForLowLatency(sdp: string, targetBitrate: number): string {
  if (!sdp) return sdp;

  const minKbps = Math.max(300, Math.round((targetBitrate * 0.35) / 1000));
  const startKbps = Math.round((targetBitrate * 0.75) / 1000);
  const maxKbps = Math.round(targetBitrate / 1000);

  const lines = sdp.split('\r\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Add low-latency flags to fmtp parameters
    if (line.startsWith('a=fmtp:')) {
      if (!line.includes('x-google-min-bitrate')) {
        line += `;x-google-min-bitrate=${minKbps};x-google-start-bitrate=${startKbps};x-google-max-bitrate=${maxKbps}`;
      }
    }

    result.push(line);

    // Inject bandwidth control right after c=IN lines in media sections
    if (line.startsWith('c=IN')) {
      result.push(`b=AS:${maxKbps}`);
      result.push(`b=TIAS:${maxKbps * 1000}`);
    }
  }

  return reorderVideoCodecs(result.join('\r\n'));
}

/**
 * Reorder m=video line payload types so hardware accelerated H.264 and VP8
 * take precedence over CPU-heavy VP9/AV1 codecs.
 */
function reorderVideoCodecs(sdp: string): string {
  const lines = sdp.split('\r\n');
  const videoLineIndex = lines.findIndex((l) => l.startsWith('m=video'));
  if (videoLineIndex === -1) return sdp;

  const parts = lines[videoLineIndex].split(' ');
  const header = parts.slice(0, 3);
  const payloadTypes = parts.slice(3);

  const codecMap = new Map<string, string>();
  for (const line of lines) {
    if (line.startsWith('a=rtpmap:')) {
      const match = line.match(/^a=rtpmap:(\d+)\s+([^\/]+)/);
      if (match) {
        codecMap.set(match[1], match[2].toUpperCase());
      }
    }
  }

  const h264Types: string[] = [];
  const vp8Types: string[] = [];
  const otherTypes: string[] = [];

  for (const pt of payloadTypes) {
    const codec = codecMap.get(pt);
    if (codec === 'H264') h264Types.push(pt);
    else if (codec === 'VP8') vp8Types.push(pt);
    else otherTypes.push(pt);
  }

  const reorderedPayloads = [...h264Types, ...vp8Types, ...otherTypes];
  if (reorderedPayloads.length > 0) {
    lines[videoLineIndex] = [...header, ...reorderedPayloads].join(' ');
  }

  return lines.join('\r\n');
}

