import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Returns a singleton Socket.IO client instance.
 * Safe for client-side execution in Next.js.
 */
export function getSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("Socket.IO client cannot be initialized on server side.");
  }

  if (!socket) {
    socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ["websocket", "polling"],
    });
  }

  return socket;
}

/**
 * Disconnect and destroy the socket instance if needed
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
