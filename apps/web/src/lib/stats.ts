/**
 * LANCam — WebRTC Stats Collector
 *
 * Collects and computes WebRTC statistics from RTCPeerConnection.
 * Provides formatted stats for the diagnostics display.
 */

import { STATS_INTERVAL_MS } from '@lancam/shared';
import type { WebRTCStats } from '@lancam/shared';

export type StatsCallback = (stats: WebRTCStats) => void;

export class StatsCollector {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private prevBytesReceived = 0;
  private prevBytesSent = 0;
  private prevTimestamp = 0;

  constructor(
    private pc: RTCPeerConnection,
    private callback: StatsCallback,
    private role: 'sender' | 'receiver',
  ) {}

  start(): void {
    this.intervalId = setInterval(() => this.collect(), STATS_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async collect(): Promise<void> {
    try {
      const rawStats = await this.pc.getStats();
      const stats = this.parseStats(rawStats);
      this.callback(stats);
    } catch {
      // Connection might be closing — ignore
    }
  }

  private parseStats(rawStats: RTCStatsReport): WebRTCStats {
    const result: WebRTCStats = {
      rtt: null,
      jitter: null,
      packetsLost: 0,
      packetsReceived: 0,
      packetsSent: 0,
      framesDecoded: 0,
      framesDropped: 0,
      fps: null,
      bitrate: null,
      codec: null,
      resolution: null,
      connectionState: this.pc.connectionState,
      iceState: this.pc.iceConnectionState,
      timestamp: Date.now(),
    };

    const codecMap = new Map<string, string>();

    rawStats.forEach((report) => {
      // Codec info
      if (report.type === 'codec') {
        codecMap.set(report.id, report.mimeType?.split('/')[1] || 'unknown');
      }

      // Candidate pair (for RTT)
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        result.rtt = report.currentRoundTripTime != null
          ? Math.round(report.currentRoundTripTime * 1000)
          : null;
      }

      // Inbound RTP (receiver side)
      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        result.packetsReceived = report.packetsReceived || 0;
        result.packetsLost = report.packetsLost || 0;
        result.jitter = report.jitter != null ? Math.round(report.jitter * 1000) : null;
        result.framesDecoded = report.framesDecoded || 0;
        result.framesDropped = report.framesDropped || 0;
        result.fps = report.framesPerSecond || null;

        if (report.frameWidth && report.frameHeight) {
          result.resolution = {
            width: report.frameWidth,
            height: report.frameHeight,
          };
        }

        // Calculate bitrate
        const now = report.timestamp;
        const bytesReceived = report.bytesReceived || 0;
        if (this.prevTimestamp > 0 && this.role === 'receiver') {
          const elapsed = (now - this.prevTimestamp) / 1000;
          if (elapsed > 0) {
            result.bitrate = Math.round(
              ((bytesReceived - this.prevBytesReceived) * 8) / elapsed,
            );
          }
        }
        this.prevBytesReceived = bytesReceived;
        this.prevTimestamp = now;

        if (report.codecId && codecMap.has(report.codecId)) {
          result.codec = codecMap.get(report.codecId) || null;
        }
      }

      // Outbound RTP (sender side)
      if (report.type === 'outbound-rtp' && report.kind === 'video') {
        result.packetsSent = report.packetsSent || 0;
        result.fps = report.framesPerSecond || null;

        if (report.frameWidth && report.frameHeight) {
          result.resolution = {
            width: report.frameWidth,
            height: report.frameHeight,
          };
        }

        // Calculate bitrate
        const now = report.timestamp;
        const bytesSent = report.bytesSent || 0;
        if (this.prevTimestamp > 0 && this.role === 'sender') {
          const elapsed = (now - this.prevTimestamp) / 1000;
          if (elapsed > 0) {
            result.bitrate = Math.round(
              ((bytesSent - this.prevBytesSent) * 8) / elapsed,
            );
          }
        }
        this.prevBytesSent = bytesSent;
        this.prevTimestamp = now;

        if (report.codecId && codecMap.has(report.codecId)) {
          result.codec = codecMap.get(report.codecId) || null;
        }
      }
    });

    return result;
  }
}

/** Format bitrate for display */
export function formatBitrate(bps: number | null): string {
  if (bps === null) return '—';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`;
  return `${bps} bps`;
}

/** Format resolution for display */
export function formatResolution(res: { width: number; height: number } | null): string {
  if (!res) return '—';
  return `${res.width}×${res.height}`;
}
