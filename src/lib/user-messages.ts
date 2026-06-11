/**
 * Mensajes de usuario reutilizables y centralizados.
 *
 * Cada mensaje lleva una `severity` (gravedad) para que la UI elija el
 * tono visual adecuado (info / warning / error) y un `text` en español
 * listo para mostrar. Centralizar estos textos evita duplicar copys y
 * mantiene un tono consistente en todo el producto.
 */

export type UserMessageSeverity = "info" | "warning" | "error";

export interface UserMessage {
  severity: UserMessageSeverity;
  text: string;
}

/**
 * Fallback (Plan de contingencia) para cuando la verificación externa de
 * disponibilidad de dominios falla, expira o el servicio está degradado.
 *
 * Es un aviso NO bloqueante: el usuario puede seguir eligiendo/escribiendo
 * el nombre aunque no se haya podido confirmar la disponibilidad del
 * DNS (Sistema de nombres de dominio).
 */
export const DOMAIN_FALLBACK_MESSAGE: UserMessage = {
  severity: "info",
  text: "No pudimos verificar disponibilidad de dominio. Procederemos sin validación externa.",
};
