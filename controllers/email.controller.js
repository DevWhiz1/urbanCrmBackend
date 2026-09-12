const { sendMail } = require('../service/email.service');
const fs = require('fs');
const path = require('path');

const emailController = {};

emailController.sendStatementEmail = async (req, res) => {
  try {
    const { toEmail, subject, message, recipientName } = req.body;
    
    if (!toEmail || !subject) {
      return res.status(400).json({ message: "Recipient email and subject are required." });
    }

    // Immediately respond to the client to avoid long waiting times
    res.status(200).json({ message: "Email sending initiated." });

    // Process the email asynchronously
    (async () => {
      try {
        let attachments = [];

        if (req.file) {
          attachments.push({
            filename: req.file.originalname || 'document.pdf',
            content: req.file.buffer
          });
        }

        // Add logo as inline attachment
        // const logoPath = path.join(__dirname, '../../crm-client/public/logo.png');
        // if (fs.existsSync(logoPath)) {
        //   attachments.push({
        //     filename: 'logo.png',
        //     path: logoPath,
        //     cid: 'urban_logo' // same cid value as in the html img src
        //   });
        // }

        const currentDate = new Date().toLocaleDateString('en-PK', {
          day: '2-digit', month: 'long', year: 'numeric'
        });

        const nameToUse = recipientName || 'Valued Client';

        const htmlTemplate = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>${subject}</title>
          </head>
          <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 40px 0;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%); padding: 40px 30px; text-align: center; border-bottom: 4px solid #926F34;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 1px;">URBAN DESIGN & CONSTRUCTION</h1>
                <p style="color: #DFB761; margin: 10px 0 0 0; font-size: 14px; font-weight: 500; letter-spacing: 2px;">BUILDING EXCELLENCE</p>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 40px 30px; color: #333333;">
                <div style="text-align: right; font-size: 14px; color: #666; margin-bottom: 20px;">
                  <strong>Date:</strong> ${currentDate}
                </div>
                
                <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>${nameToUse}</strong>,</p>

                <h2 style="margin: 0 0 25px 0; color: #1e1e1e; font-size: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 15px;">${subject}</h2>
                
                ${message ? `
                <div style="background-color: #f8fafc; border-left: 4px solid #926F34; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 30px;">
                  <p style="margin: 0; line-height: 1.6; color: #475569; white-space: pre-line;">${message}</p>
                </div>
                ` : `
                <p style="font-size: 16px; line-height: 1.6; color: #4b5563; margin-bottom: 25px;">
                  Please find your document attached to this email. If you have any questions or require further clarification, do not hesitate to contact us.
                </p>
                `}

                <p style="margin-top: 30px; margin-bottom: 5px; font-size: 14px;">Thank you for your continued business.</p>
                <p style="margin: 0; font-size: 14px;">Best regards,<br><strong>Accounts Department</strong><br>Urban Design &amp; Construction</p>
              </div>

              <!-- Footer -->
              <div style="background-color: #fafafa; padding: 30px 40px; text-align: center; border-top: 1px solid #eeeeee;">
                <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; font-weight: 500;">Urban Design & Construction</p>
                <p style="margin: 0 0 5px 0; color: #9ca3af; font-size: 13px;">Multi Gardens B-17, Islamabad | +92 315-587 4112 | +92 333-383 4040</p>
                <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                  <a href="mailto:urbandesconstb17@gmail.com" style="color: #926F34; text-decoration: none;">urbandesconstb17@gmail.com</a> | 
                  <a href="https://www.urbandesconst.com" style="color: #926F34; text-decoration: none;">www.urbandesconst.com</a>
                </p>
              </div>
            </div>
          </body>
          </html>
        `;

        await sendMail(toEmail, subject, 'Please find your document attached.', htmlTemplate, attachments);
      } catch (error) {
        console.error("Error in background email sending task:", error);
      }
    })();

  } catch (error) {
    console.error("Error initiating statement email:", error);
    res.status(500).json({ message: "Failed to initiate email sending.", error: error.message });
  }
};

module.exports = emailController;
