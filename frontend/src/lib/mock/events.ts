/**
 * In-browser stand-in for the Socket.IO server. Mock handlers publish events
 * here; the realtime hook subscribes the same way it would to a socket.
 */
type Listener = (event: string, payload: unknown) => void;

const listeners = new Map<string, Set<Listener>>();

export const mockBus = {
  subscribe(userId: string, listener: Listener): () => void {
    if (!listeners.has(userId)) listeners.set(userId, new Set());
    listeners.get(userId)!.add(listener);
    return () => listeners.get(userId)?.delete(listener);
  },
  emit(userId: string, event: string, payload: unknown): void {
    // Deliver asynchronously, like a socket would.
    setTimeout(() => listeners.get(userId)?.forEach((l) => l(event, payload)), 250);
  },
};
