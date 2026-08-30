const cron = require('node-cron');
const { Patient } = require('../models');
const { sendEmail } = require('./mailer');

const DEST_EMAIL = process.env.NOTIFICATION_EMAIL || 'natafeli99@hotmail.com';

/**
 * Checks for patient birthdays today and sends an email notification if any exist.
 * @returns {Promise<Object>} Result summary
 */
const checkAndSendBirthdayEmails = async () => {
  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDay = today.getDate(); // 1-31
    const todayDayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

    const activePatients = await Patient.findAll({
      where: { isInactive: false }
    });

    const todaysBirthdays = [];
    const weekendBirthdays = [];

    activePatients.forEach(p => {
      if (!p.birthDate) return;
      const datePart = p.birthDate.split('T')[0];
      const [birthYearStr, monthStr, dayStr] = datePart.split('-');
      const birthYear = parseInt(birthYearStr, 10);
      const bMonth = parseInt(monthStr, 10);
      const bDay = parseInt(dayStr, 10);

      const age = currentYear - birthYear;

      // Exact birthday today
      if (bMonth === currentMonth && bDay === currentDay) {
        todaysBirthdays.push({ patient: p, age, isToday: true });
        return;
      }

      // Weekend proxies for Friday and Monday
      const bdDate = new Date(currentYear, bMonth - 1, bDay);
      const bdDow = bdDate.getDay();

      if (todayDayOfWeek === 5 && (bdDow === 6 || bdDow === 0)) {
        // Today is Friday: upcoming Saturday or Sunday birthday
        const diffDays = Math.round((bdDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 2) {
          const dayTag = bdDow === 6 ? 'Sábado' : 'Domingo';
          weekendBirthdays.push({ patient: p, age, tag: `→ ${dayTag}` });
        }
      } else if (todayDayOfWeek === 1 && (bdDow === 6 || bdDow === 0)) {
        // Today is Monday: past weekend birthday (Sat/Sun)
        const diffDays = Math.round((today - bdDate) / (1000 * 60 * 60 * 24));
        if (diffDays >= 1 && diffDays <= 2) {
          const dayTag = bdDow === 6 ? 'Sábado' : 'Domingo';
          weekendBirthdays.push({ patient: p, age, tag: `← ${dayTag}` });
        }
      }
    });

    if (todaysBirthdays.length === 0 && weekendBirthdays.length === 0) {
      console.log('[BirthdayCron] No hay cumpleaños para notificar hoy.');
      return { sent: false, count: 0, message: 'No hay cumpleaños hoy' };
    }

    const todayFormatted = today.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #ffffff;">
        <h2 style="color: #d97706; margin-top: 0; display: flex; align-items: center; gap: 8px;">
          🎂 Notificación de Cumpleaños de Pacientes
        </h2>
        <p style="color: #4a5568; font-size: 15px;">
          Fecha: <strong>${todayFormatted}</strong>
        </p>
    `;

    if (todaysBirthdays.length > 0) {
      htmlContent += `
        <h3 style="color: #2b6cb0; border-bottom: 2px solid #ebf8ff; padding-bottom: 6px;">Cumpleaños de HOY 🎉</h3>
        <ul style="list-style-type: none; padding: 0;">
      `;

      todaysBirthdays.forEach(({ patient: p, age }) => {
        htmlContent += `
          <li style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
            <strong style="font-size: 16px; color: #92400e;">${p.firstName} ${p.lastName}</strong><br/>
            <span style="font-size: 14px; color: #78350f;">Cumple <strong>${age} años</strong> hoy.</span><br/>
            <span style="font-size: 13px; color: #4a5568;">DNI: ${p.docNumber || 'N/A'} | Teléfono: ${p.phone || 'Sin teléfono'} | Email: ${p.email || 'Sin email'}</span>
          </li>
        `;
      });

      htmlContent += `</ul>`;
    }

    if (weekendBirthdays.length > 0) {
      htmlContent += `
        <h3 style="color: #d97706; border-bottom: 2px solid #fef3c7; padding-bottom: 6px;">Cumpleaños del Fin de Semana 📅</h3>
        <ul style="list-style-type: none; padding: 0;">
      `;

      weekendBirthdays.forEach(({ patient: p, age, tag }) => {
        htmlContent += `
          <li style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
            <strong style="font-size: 15px; color: #2d3748;">${p.firstName} ${p.lastName}</strong> (${tag})<br/>
            <span style="font-size: 13px; color: #4a5568;">Cumple <strong>${age} años</strong>. | Teléfono: ${p.phone || 'N/A'}</span>
          </li>
        `;
      });

      htmlContent += `</ul>`;
    }

    htmlContent += `
        <hr style="border: none; border-top: 1px solid #edf2f7; margin: 20px 0;" />
        <p style="font-size: 12px; color: #a0aec0; text-align: center; margin-bottom: 0;">
          Notificación automática enviada desde Kümespacio Portal.
        </p>
      </div>
    `;

    const subject = todaysBirthdays.length > 0
      ? `🎂 ¡Hoy cumple años ${todaysBirthdays.map(b => b.patient.firstName).join(', ')}! - Kümespacio`
      : `🎂 Aviso de cumpleaños de fin de semana - Kümespacio`;

    await sendEmail({
      to: DEST_EMAIL,
      subject,
      html: htmlContent
    });

    console.log(`[BirthdayCron] Correo enviado exitosamente a ${DEST_EMAIL}`);
    return { sent: true, count: todaysBirthdays.length + weekendBirthdays.length };

  } catch (err) {
    console.error('[BirthdayCron] Error al verificar/enviar cumpleaños:', err);
    throw err;
  }
};

/**
 * Initializes daily cron job at 08:00 AM.
 */
const initBirthdayCron = () => {
  // Run every day at 8:00 AM ('0 8 * * *')
  cron.schedule('0 8 * * *', () => {
    console.log('[BirthdayCron] Ejecutando tarea diaria de control de cumpleaños...');
    checkAndSendBirthdayEmails();
  });
  console.log('[BirthdayCron] Tarea diaria programada para las 08:00 AM (envía correos a ' + DEST_EMAIL + ').');
};

module.exports = {
  checkAndSendBirthdayEmails,
  initBirthdayCron
};
