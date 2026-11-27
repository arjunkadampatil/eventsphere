const nodemailer = require('nodemailer');
const env = require('../config/env');

const transport = env.smtpEnabled
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

const sent = []; // last messages, inspected by tests

async function sendMail({ to, subject, text }) {
  try {
    const info = await transport.sendMail({ from: env.MAIL_FROM, to, subject, text });
    if (env.isTest) sent.push({ to, subject, text });
    else if (!env.smtpEnabled) console.log(`[mail] to=${to} subject="${subject}"\n${text}`);
    return info;
  } catch (err) {
    console.error('Email failed:', err.message);
    return null;
  }
}

const formatWhen = (date) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(date);

function registrationEmail(user, event, registration) {
  return sendMail({
    to: user.email,
    subject: `You're registered: ${event.title}`,
    text: [
      `Hi ${user.name},`,
      '',
      `You're registered for ${event.title}.`,
      `When: ${formatWhen(event.startsAt)}`,
      `Where: ${event.mode === 'online' ? 'Online' : event.venue}`,
      `Ticket code: ${registration.ticketCode}`,
      '',
      `Your QR ticket is in your dashboard: ${env.CLIENT_URL}/dashboard`,
    ].join('\n'),
  });
}

function passwordResetEmail(user, link) {
  return sendMail({
    to: user.email,
    subject: 'Reset your EventSphere password',
    text: `Hi ${user.name},\n\nReset your password within 1 hour using this link:\n${link}\n\nIf you didn't ask for this, ignore this email.`,
  });
}

module.exports = { sendMail, registrationEmail, passwordResetEmail, sent };
