import { io, type Socket } from "socket.io-client";
import { API_URL } from "@/lib/env";

let socket: Socket | null = null;

/**
 * Socket singleton (uma conexão por aba) para eventos de tempo real do backend.
 * A autenticação é a MESMA do HTTP: `withCredentials` envia o cookie httpOnly de
 * sessão no handshake, e o gateway valida o JWT e coloca o socket numa sala
 * privada `user:<id>`. `autoConnect:false` → conecta só quando o hook ativa.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      withCredentials: true,
      extraHeaders: { "x-pt-surface": "client" }, // superfície de sessão (handshake polling)
      autoConnect: false,
      reconnection: true,
    });
  }
  return socket;
}
