import { Resend } from "resend";

/**
 * Resend wrapper para enviar correos transaccionales.
 *
 * El envío es "graceful": si `RESEND_API_KEY` no está configurada, NO lanzamos
 * un error — devolvemos `{ sent: false }` para que el panel de admin pueda
 * seguir funcionando y mostrar el enlace de invitación para copiarlo a mano.
 */

const FROM = process.env.RESEND_FROM || "BrewIdea <onboarding@resend.dev>";

function invitationHtml(inviteUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#1e293b;border:1px solid #334155;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0;font-size:22px;line-height:1.3;color:#fbbf24;font-weight:700;">Te han invitado a BrewIdea</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px 32px;">
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#cbd5e1;">
                  Hola, has recibido una invitación para acceder a <strong style="color:#ffffff;">BrewIdea</strong>,
                  una <strong style="color:#ffffff;">demo privada en fase de prototipo</strong> para generar y validar ideas de negocio con IA.
                </p>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#cbd5e1;">
                  Pulsa el botón para crear tu cuenta y empezar:
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                  <tr>
                    <td align="center" style="border-radius:10px;background-color:#f59e0b;">
                      <a href="${inviteUrl}" target="_blank"
                        style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#0f172a;text-decoration:none;border-radius:10px;">
                        Aceptar invitación
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#94a3b8;">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:
                </p>
                <p style="margin:0 0 24px 0;font-size:13px;line-height:1.6;word-break:break-all;">
                  <a href="${inviteUrl}" target="_blank" style="color:#fbbf24;text-decoration:underline;">${inviteUrl}</a>
                </p>
                <p style="margin:0;padding-top:16px;border-top:1px solid #334155;font-size:12px;line-height:1.6;color:#64748b;">
                  Por seguridad, este enlace de invitación caduca pasados unos días. Si caduca, pide al administrador que te reenvíe una nueva invitación.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendInvitationEmail(
  to: string,
  inviteUrl: string
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY no configurada" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: "Te han invitado a BrewIdea (demo privada)",
      html: invitationHtml(inviteUrl),
    });

    if (error) {
      return { sent: false, error: error.message || "Error al enviar el correo" };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Error al enviar el correo",
    };
  }
}
