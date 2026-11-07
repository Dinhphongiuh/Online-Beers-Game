import * as Tone from 'tone';
import type { SignalIn } from '../../shared/tableNet';
import type { TableNetClient } from './tableClient';

/**
 * Bàn nhậu voice chat: WebRTC mesh (≤8 people, signaled over the Colyseus room) with a
 * Tone.js "rượu vào lời ra" chain on the OUTGOING mic, so friends hear you slur:
 *
 *   mic → PitchShift → Vibrato → (+ random "Hic!") → MediaStreamDestination → peers
 *
 * Remote voices are stereo-panned by where that friend sits on screen.
 */

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
const SPEAKING_RMS = 0.045;

interface Peer {
  id: string;
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  panner: StereoPannerNode | null;
  gain: GainNode | null;
  source: MediaStreamAudioSourceNode | null;
  pendingIce: RTCIceCandidateInit[];
}

export interface VoiceState {
  active: boolean;
  muted: boolean;
  /** Drunk FX currently applied to the outgoing voice (0 = clean). */
  fxAmount: number;
  peers: number;
  error: string | null;
}

export class VoiceChat {
  onState?: (s: VoiceState) => void;
  /** Local mic level 0..1 at ~10 Hz (for lip-sync and the net "speaking" flag). */
  onLevel?: (level: number, speaking: boolean) => void;
  /** A "Hic!" was injected into your voice. */
  onHiccup?: () => void;

  private state: VoiceState = { active: false, muted: false, fxAmount: 0, peers: 0, error: null };
  private micStream: MediaStream | null = null;
  private outStream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private pitch: Tone.PitchShift | null = null;
  private vibrato: Tone.Vibrato | null = null;
  private hiccupSynth: Tone.MembraneSynth | null = null;
  private outGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private meterTimer: number | null = null;
  private hiccupTimer: number | null = null;
  private peers = new Map<string, Peer>();
  private offs: (() => void)[] = [];
  private drunk = 0;

  constructor(private net: TableNetClient) {}

  get current() {
    return this.state;
  }

  async start() {
    if (this.state.active) return true;
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      this.patch({ error: 'Không mở được micro (chưa cho phép quyền?)' });
      console.warn('[voice] mic error', err);
      return false;
    }

    // A native AudioContext shared with Tone, so mic/WebRTC nodes and Tone FX live together
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    Tone.setContext(new Tone.Context(ctx));
    await Tone.start();
    await ctx.resume().catch(() => null);
    this.ctx = ctx;

    const src = ctx.createMediaStreamSource(this.micStream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    src.connect(this.analyser);

    this.pitch = new Tone.PitchShift({ pitch: 0, windowSize: 0.08, wet: 0 });
    this.vibrato = new Tone.Vibrato({ frequency: 5, depth: 0, wet: 0 });
    this.outGain = ctx.createGain();
    const dest = ctx.createMediaStreamDestination();
    Tone.connect(src, this.pitch);
    this.pitch.connect(this.vibrato);
    this.vibrato.connect(this.outGain);
    this.outGain.connect(dest);

    // "Hic!" — a short pitched thump straight into the outgoing voice
    this.hiccupSynth = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 3,
      envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.05 },
      volume: -6,
    });
    this.hiccupSynth.connect(this.outGain);

    this.outStream = dest.stream;
    this.applyDrunkFx();
    this.startMeter();
    this.scheduleHiccup();
    this.bindSignaling();
    this.patch({ active: true, error: null });
    this.net.rtcJoin();
    return true;
  }

  stop() {
    this.offs.forEach((off) => off());
    this.offs = [];
    this.peers.forEach((p) => this.closePeer(p.id));
    if (this.meterTimer) window.clearInterval(this.meterTimer);
    if (this.hiccupTimer) window.clearTimeout(this.hiccupTimer);
    this.meterTimer = this.hiccupTimer = null;
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    this.pitch?.dispose();
    this.vibrato?.dispose();
    this.hiccupSynth?.dispose();
    this.pitch = this.vibrato = null;
    this.hiccupSynth = null;
    this.outGain?.disconnect();
    this.outGain = null;
    void this.ctx?.close().catch(() => null);
    this.ctx = null;
    this.analyser = null;
    this.outStream = null;
    this.onLevel?.(0, false);
    this.patch({ active: false, peers: 0 });
  }

  setMuted(muted: boolean) {
    this.micStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.patch({ muted });
  }

  /** Độ Cồn 0..100 — above 60% the voice starts to slur. */
  setDrunkLevel(level: number) {
    this.drunk = level;
    this.applyDrunkFx();
  }

  /** Pan each remote voice by its seat: x in -1..1 (screen left/right), near 0..1. */
  setPeerSpatial(sessionId: string, pan: number, near: number) {
    const p = this.peers.get(sessionId);
    if (!p?.panner || !p.gain || !this.ctx) return;
    const t = this.ctx.currentTime;
    p.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.08);
    p.gain.gain.setTargetAtTime(0.55 + 0.6 * Math.max(0, Math.min(1, near)), t, 0.1);
  }

  private applyDrunkFx() {
    const k = Math.max(0, Math.min(1, (this.drunk - 60) / 40)); // 60% → 0, 100% → 1
    this.patch({ fxAmount: k });
    if (!this.pitch || !this.vibrato) return;
    this.pitch.pitch = -1.5 - k * 3; // deeper, muddier
    this.pitch.wet.rampTo(k > 0 ? 0.55 + k * 0.45 : 0, 0.5);
    this.vibrato.frequency.rampTo(4 + k * 2.5, 0.5);
    this.vibrato.depth.rampTo(0.08 + k * 0.32, 0.5);
    this.vibrato.wet.rampTo(k > 0 ? 1 : 0, 0.5);
  }

  private scheduleHiccup() {
    if (this.hiccupTimer) window.clearTimeout(this.hiccupTimer);
    this.hiccupTimer = window.setTimeout(() => {
      this.hiccupTimer = null;
      if (!this.state.active) return;
      if (this.drunk >= 70 && !this.state.muted && this.hiccupSynth) {
        this.hiccupSynth.triggerAttackRelease(Tone.Frequency(380 + Math.random() * 120, 'hz').toNote(), '16n');
        this.onHiccup?.();
      }
      this.scheduleHiccup();
    }, 6000 + Math.random() * 8000);
  }

  private startMeter() {
    const buf = new Float32Array(this.analyser!.fftSize);
    this.meterTimer = window.setInterval(() => {
      if (!this.analyser) return;
      this.analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const level = Math.min(1, rms * 6);
      this.onLevel?.(this.state.muted ? 0 : level, !this.state.muted && rms > SPEAKING_RMS);
    }, 100);
  }

  // ---------------------------------------------------------------- WebRTC mesh
  private bindSignaling() {
    const n = this.net;
    this.offs.push(
      // Newcomer offers to everyone already in the mesh
      n.onRtcPeers.on((ids) => ids.forEach((id) => void this.callPeer(id))),
      n.onRtcPeerLeft.on((id) => this.closePeer(id)),
      n.onRtcOffer.on((m) => void this.handleOffer(m)),
      n.onRtcAnswer.on((m) => void this.handleAnswer(m)),
      n.onRtcIce.on((m) => void this.handleIce(m)),
      // Server restarted / reconnected: rejoin the mesh
      n.onConnection.on((s) => {
        if (s === 'online' && this.state.active) {
          this.peers.forEach((p) => this.closePeer(p.id));
          n.rtcJoin();
        }
      })
    );
  }

  private createPeer(id: string): Peer {
    const existing = this.peers.get(id);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.outStream?.getAudioTracks().forEach((track) => pc.addTrack(track, this.outStream!));
    const audioEl = new Audio();
    audioEl.autoplay = true;
    // Chrome only feeds a remote WebRTC stream into Web Audio if an element plays it too
    audioEl.muted = true;
    const peer: Peer = { id, pc, audioEl, panner: null, gain: null, source: null, pendingIce: [] };

    pc.onicecandidate = (e) => {
      if (e.candidate) this.net.rtcIce({ targetId: id, candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      audioEl.srcObject = stream;
      void audioEl.play().catch(() => null);
      if (this.ctx && !peer.source) {
        peer.source = this.ctx.createMediaStreamSource(stream);
        peer.panner = this.ctx.createStereoPanner();
        peer.gain = this.ctx.createGain();
        peer.gain.gain.value = 0.9;
        peer.source.connect(peer.panner).connect(peer.gain).connect(this.ctx.destination);
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.closePeer(id);
      this.patch({ peers: [...this.peers.values()].filter((p) => p.pc.connectionState === 'connected').length });
    };
    this.peers.set(id, peer);
    return peer;
  }

  private async callPeer(id: string) {
    const peer = this.createPeer(id);
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    this.net.rtcOffer({ targetId: id, sdp: { type: offer.type, sdp: offer.sdp } });
  }

  private async handleOffer(m: SignalIn) {
    if (!m.sdp || !this.state.active) return;
    const peer = this.createPeer(m.peerId);
    await peer.pc.setRemoteDescription(m.sdp as RTCSessionDescriptionInit);
    await this.flushIce(peer);
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    this.net.rtcAnswer({ targetId: m.peerId, sdp: { type: answer.type, sdp: answer.sdp } });
  }

  private async handleAnswer(m: SignalIn) {
    const peer = this.peers.get(m.peerId);
    if (!peer || !m.sdp) return;
    await peer.pc.setRemoteDescription(m.sdp as RTCSessionDescriptionInit);
    await this.flushIce(peer);
  }

  private async handleIce(m: SignalIn) {
    const peer = this.peers.get(m.peerId);
    if (!peer || !m.candidate) return;
    if (!peer.pc.remoteDescription) {
      peer.pendingIce.push(m.candidate);
      return;
    }
    await peer.pc.addIceCandidate(m.candidate).catch(() => null);
  }

  private async flushIce(peer: Peer) {
    const queued = peer.pendingIce.splice(0);
    for (const c of queued) await peer.pc.addIceCandidate(c).catch(() => null);
  }

  private closePeer(id: string) {
    const p = this.peers.get(id);
    if (!p) return;
    p.pc.close();
    p.source?.disconnect();
    p.gain?.disconnect();
    p.audioEl.srcObject = null;
    this.peers.delete(id);
    this.patch({ peers: [...this.peers.values()].filter((x) => x.pc.connectionState === 'connected').length });
  }

  private patch(partial: Partial<VoiceState>) {
    this.state = { ...this.state, ...partial };
    this.onState?.(this.state);
  }
}

/** RMS (0..1) of a mic shout → a rough, fun dB reading for the "DZÔ" contest. */
export function rmsToDecibel(rms: number) {
  if (rms <= 0) return 30;
  return Math.max(30, Math.min(130, Math.round(100 + 20 * Math.log10(rms))));
}
