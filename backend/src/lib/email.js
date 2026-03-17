const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_PORT === '465', // SSL for 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail({ to, subject, body }) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html: body,
  });
}

module.exports = { sendEmail };
