import type { App } from '../ui/app';
import { toast } from '../ui/dom';

/** Partida online (cliente) — implementado junto com o servidor (server/). */
export function startOnlineMatch(app: App, msg: Record<string, unknown>): void {
  void app;
  void msg;
  toast('Partida online: em construção.', 'info');
}
