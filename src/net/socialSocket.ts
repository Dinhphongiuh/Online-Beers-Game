/**
 * One realtime socket per signed-in tab (Colyseus room "social_hub"). The server pushes
 * friend requests / accepts / table invites / presence changes; components subscribe with
 * useSocialEvents(). Reconnects with backoff; the REST poll in useSocial stays as a fallback.
 */
import { useEffect, useRef, useState } from 'react';
import { Client, type Room } from '@colyseus/sdk';
import { SOCIAL_EVENT_MSG, SOCIAL_ROOM_NAME, type SocialEvent } from '../../shared/social';

type Listener<A extends unknown[]> = (...args: A) => void;
class Emitter<A extends unknown[]> {
  private set = new Set<Listener<A>>();
  on(fn: Listener<A>) {
    this.set.add(fn);
    return () => {
      this.set.delete(fn);
    };
  }
  emit(...args: A) {
    this.set.forEach((fn) => fn(...args));
  }
}

const TOKEN_KEY = 'tram_nhau_auth_token';

class SocialSocket {
  readonly events = new Emitter<[SocialEvent]>();
  readonly status = new Emitter<[boolean]>();
  live = false;
  private room: Room | null = null;
  private wanted = false;
  private retryTimer = 0;
  private attempt = 0;
  private connecting = false;

  start() {
    this.wanted = true;
    void this.connect();
  }

  stop() {
    this.wanted = false;
    clearTimeout(this.retryTimer);
    const room = this.room;
    this.room = null;
    this.setLive(false);
    void room?.leave(true).catch(() => null);
  }

  private setLive(v: boolean) {
    if (this.live === v) return;
    this.live = v;
    this.status.emit(v);
  }

  private async connect() {
    if (!this.wanted || this.room || this.connecting) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    this.connecting = true;
    try {
      const room = await new Client(window.location.origin).joinOrCreate(SOCIAL_ROOM_NAME, { token });
      if (!this.wanted) {
        void room.leave(true);
        return;
      }
      this.room = room;
      this.attempt = 0;
      this.setLive(true);
      room.onMessage(SOCIAL_EVENT_MSG, (e: SocialEvent) => this.events.emit(e));
      room.onLeave(() => {
        this.room = null;
        this.setLive(false);
        this.scheduleRetry();
      });
    } catch {
      this.scheduleRetry();
    } finally {
      this.connecting = false;
    }
  }

  private scheduleRetry() {
    if (!this.wanted) return;
    clearTimeout(this.retryTimer);
    const delay = Math.min(30_000, 1000 * 2 ** this.attempt++);
    this.retryTimer = window.setTimeout(() => void this.connect(), delay);
  }
}

export const socialSocket = new SocialSocket();

/** Root: keep the socket open while signed in. */
export function useSocialSocket(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    socialSocket.start();
    return () => socialSocket.stop();
  }, [enabled]);
}

/** Subscribe to pushed events (handler may change between renders). */
export function useSocialEvents(handler: (e: SocialEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => socialSocket.events.on((e) => ref.current(e)), []);
}

export function useSocialLive() {
  const [live, setLive] = useState(socialSocket.live);
  useEffect(() => socialSocket.status.on(setLive), []);
  return live;
}
