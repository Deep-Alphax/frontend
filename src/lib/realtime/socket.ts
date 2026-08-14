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
      // Reconexão LIMITADA: cobre blips do backend, mas PARA de martelar o handshake
      // quando ele está fora do ar (senão vira enxurrada de requests). Um reload
      // re-tenta; o contador zera sozinho a cada conexão bem-sucedida.
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
    });
  }
  return socket;
}
