const nodemailer = require('nodemailer');
const EmailLog = require('../models/emailLog.schema');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendMail = async (to, subject, text, html = null, attachments = []) => {
  const senderName = "Accounts - Urban Design Construction";
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
  
  const mailOptions = {
    from: `"${senderName}" <${fromAddress}>`,
    to,
    subject,
    text,
  };

  if (html) {
    mailOptions.html = html;
  }

  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to: ${to}, Message ID: ${info.messageId}`);
    
    // Log to Database
    await EmailLog.create({
      to,
      subject,
      text,
      html,
      messageId: info.messageId,
      status: 'Sent'
    });

    return { success: true, message: 'Email sent successfully', messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error in sending mail', error);
    
    // Log failure to Database
    await EmailLog.create({
      to,
      subject,
      text,
      html,
      status: 'Failed',
      error: error.message
    });

    throw new Error('Failed to send email: ' + error.message);
  }
};

module.exports = { sendMail };
