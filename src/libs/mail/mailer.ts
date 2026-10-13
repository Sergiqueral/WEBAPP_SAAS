/* eslint-disable no-console */
import nodemailer from 'nodemailer';

export type SendVerificationEmailParams = {
  to: string;
  name?: string | null;
  verificationUrl: string;
};

export async function sendVerificationEmail({
  to,
  name,
  verificationUrl,
}: SendVerificationEmailParams) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `"Gorila SaaS" <${user || 'notificaciones@serveix.work'}>`;

  // Fallback si no hay credenciales SMTP configuradas aún
  if (!host || !user || !pass) {
    console.warn('⚠️ [Mailer] SMTP no configurado (SMTP_HOST / SMTP_USER / SMTP_PASS no encontrados).');
    console.warn(`📧 [Mailer] Enlace de activación para ${to}:`);
    console.warn(`👉 ${verificationUrl}`);
    return { success: true, simulated: true };
  }

  const recipientName = name || 'Usuario de Gorila';

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Verifica tu cuenta en Gorila SaaS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #09090b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e4e4e7;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #09090b;
      padding: 40px 10px;
    }
    .card {
      max-width: 560px;
      margin: 0 auto;
      background-color: #121215;
      border: 1px solid #27272a;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .header {
      padding: 32px 32px 20px;
      text-align: center;
      border-bottom: 1px solid #1f1f23;
    }
    .brand {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #10b981;
    }
    .badge {
      display: inline-block;
      margin-top: 8px;
      background-color: rgba(16, 185, 129, 0.1);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.2);
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 32px;
    }
    h1 {
      margin: 0 0 16px;
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
    }
    p {
      margin: 0 0 20px;
      font-size: 14px;
      line-height: 1.6;
      color: #a1a1aa;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      background-color: #10b981;
      color: #ffffff !important;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      padding: 13px 32px;
      border-radius: 12px;
      box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.39);
    }
    .alt-url {
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 12px;
      word-break: break-all;
      font-size: 12px;
      color: #71717a;
      font-family: monospace;
    }
    .footer {
      padding: 24px 32px;
      text-align: center;
      background-color: #0d0d10;
      border-top: 1px solid #1f1f23;
      font-size: 12px;
      color: #52525b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="card" width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td class="header">
          <div class="brand">GORILA</div>
          <div class="badge">Gestión Molecular · SaaS</div>
        </td>
      </tr>
      <tr>
        <td class="content">
          <h1>¡Hola, ${recipientName}!</h1>
          <p>
            Gracias por registrarte en Gorila. Para proteger la seguridad de tu espacio de trabajo y activar tu cuenta, por favor confirma tu dirección de correo electrónico pulsando en el botón siguiente:
          </p>
          <div class="btn-container">
            <a href="${verificationUrl}" class="btn" target="_blank">Verificar mi correo electrónico</a>
          </div>
          <p style="font-size: 12px; color: #71717a;">
            Este enlace de activación es válido durante las próximas 24 horas. Si tú no solicitaste esta cuenta, puedes ignorar este mensaje con total seguridad.
          </p>
          <p style="font-size: 12px; color: #71717a; margin-top: 24px;">
            Si el botón no funciona, copia y pega el siguiente enlace directamente en tu navegador:
          </p>
          <div class="alt-url">${verificationUrl}</div>
        </td>
      </tr>
      <tr>
        <td class="footer">
          © 2026 Gorila SaaS · <a href="https://gorila.serveix.work" style="color: #71717a; text-decoration: none;">gorila.serveix.work</a><br>
          Infraestructura Segura Serveix
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject: 'Verifica tu cuenta en Gorila SaaS',
      text: `Hola ${recipientName},\n\nPor favor verifica tu correo en Gorila accediendo al siguiente enlace:\n${verificationUrl}\n\nEste enlace expira en 24 horas.`,
      html: htmlContent,
    });

    console.log(`✉️ [Mailer] Correo de verificación enviado a ${to} (ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ [Mailer] Error al enviar correo de verificación:', error);
    // Devolvemos el error pero no bloqueamos de forma fatal
    return { success: false, error };
  }
}
