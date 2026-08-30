const nodemailer = require('nodemailer');

const createTransporter = () => {
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });
  }

  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  return null;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[Mailer] No hay configuración de SMTP / Email en el entorno (.env). Configure GMAIL_USER/GMAIL_PASS o SMTP_HOST/SMTP_USER/SMTP_PASS.');
    throw new Error('Configuración de correo no encontrada en las variables de entorno.');
  }

  const from = process.env.EMAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER || '"Kümespacio Portal" <no-reply@kumespacio.com>';

  const mailOptions = {
    from,
    to,
    subject,
    text,
    html
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('[Mailer] Correo enviado exitosamente:', info.messageId);
  return info;
};

module.exports = {
  sendEmail
};
