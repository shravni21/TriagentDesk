import nodemailer from "nodemailer";

export const sendMail = async (to, subject, text, html = null) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAILTRAP_SMTP_HOST,
      port: process.env.MAILTRAP_SMTP_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.MAILTRAP_SMTP_USER,
        pass: process.env.MAILTRAP_SMTP_PASS,
      },
    });

    const mailOptions = {
      from: '"AI Ticket Assistant" <noreply@aiticketassistant.com>',
      to,
      subject,
      text,
    };

    if (html) {
      mailOptions.html = html;
    }

    const info = await transporter.sendMail(mailOptions);

    console.log("Message sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Mail error", error.message);
    throw error;
  }
};

export const sendTicketCreationEmail = async (ticket, assignedUser = null) => {
  try {
    const subject = `New Ticket Created: ${ticket.title}`;
    
    // Plain text version
    const text = `
New Ticket Created

Title: ${ticket.title}
Description: ${ticket.description}
Status: ${ticket.status}
Priority: ${ticket.priority || 'Not set'}
Level: ${ticket.level || 'L1'}
Created: ${new Date(ticket.createdAt).toLocaleString()}
${assignedUser ? `Assigned to: ${assignedUser.email}` : 'Not yet assigned'}

You can view the ticket details in the dashboard.
    `;

    // HTML version
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Ticket Created</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
        .ticket-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; color: white; }
        .badge-high { background: #dc2626; }
        .badge-medium { background: #ea580c; }
        .badge-low { background: #16a34a; }
        .badge-l1 { background: #2563eb; }
        .badge-l2 { background: #7c3aed; }
        .badge-l3 { background: #dc2626; }
        .badge-todo { background: #ea580c; }
        .badge-progress { background: #0891b2; }
        .badge-done { background: #16a34a; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎫 New Ticket Created</h1>
        </div>
        <div class="content">
            <div class="ticket-info">
                <h2>${ticket.title}</h2>
                <p><strong>Description:</strong> ${ticket.description}</p>
                
                <div style="margin: 15px 0;">
                    <span class="badge badge-${ticket.status?.toLowerCase() || 'todo'}">${ticket.status || 'TODO'}</span>
                    ${ticket.priority ? `<span class="badge badge-${ticket.priority}">${ticket.priority.toUpperCase()}</span>` : ''}
                    ${ticket.level ? `<span class="badge badge-${ticket.level.toLowerCase()}">${ticket.level}</span>` : ''}
                </div>
                
                <p><strong>Created:</strong> ${new Date(ticket.createdAt).toLocaleString()}</p>
                ${assignedUser ? `<p><strong>Assigned to:</strong> ${assignedUser.email}</p>` : '<p><strong>Status:</strong> Awaiting assignment</p>'}
            </div>
            
            ${ticket.helpfulNotes ? `
            <div class="ticket-info">
                <h3>🤖 AI Analysis & Notes</h3>
                <p style="white-space: pre-wrap;">${ticket.helpfulNotes}</p>
            </div>
            ` : ''}
            
            ${ticket.relatedSkills && ticket.relatedSkills.length > 0 ? `
            <div class="ticket-info">
                <h3>🔧 Required Skills</h3>
                <p>${ticket.relatedSkills.map(skill => `<span class="badge badge-l1" style="margin-right: 5px;">${skill}</span>`).join('')}</p>
            </div>
            ` : ''}
            
            <div class="footer">
                <p>This is an automated notification from the AI Ticket Assistant system.</p>
                <p>Please log into the dashboard to view full ticket details and take action.</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    // Send to assigned user if available, otherwise to admins
    const recipients = assignedUser ? [assignedUser.email] : [];
    
    // You can also add admin emails here if needed
    // const adminEmails = ['admin@company.com', 'support@company.com'];
    // recipients.push(...adminEmails);

    if (recipients.length > 0) {
      await sendMail(recipients.join(', '), subject, text, html);
      console.log(`✅ Ticket creation email sent to: ${recipients.join(', ')}`);
    } else {
      console.log('⚠️ No recipients configured for ticket notification email');
    }

  } catch (error) {
    console.error('❌ Failed to send ticket creation email:', error.message);
    // Don't throw error to avoid breaking ticket creation flow
  }
};

export const sendTicketAssignmentEmail = async (ticket, assignedUser) => {
  try {
    const subject = `Ticket Assigned: ${ticket.title}`;
    
    const text = `
Ticket Assignment

You have been assigned a new ticket:

Title: ${ticket.title}
Description: ${ticket.description}
Priority: ${ticket.priority || 'Not set'}
Level: ${ticket.level || 'L1'}
Status: ${ticket.status}

Please review and take action on this ticket.
    `;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket Assigned</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7c3aed; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
        .ticket-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; color: white; }
        .badge-high { background: #dc2626; }
        .badge-medium { background: #ea580c; }
        .badge-low { background: #16a34a; }
        .badge-l1 { background: #2563eb; }
        .badge-l2 { background: #7c3aed; }
        .badge-l3 { background: #dc2626; }
        .cta { background: #2563eb; color: white; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0; }
        .cta a { color: white; text-decoration: none; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Ticket Assigned to You</h1>
        </div>
        <div class="content">
            <div class="ticket-info">
                <h2>${ticket.title}</h2>
                <p><strong>Description:</strong> ${ticket.description}</p>
                
                <div style="margin: 15px 0;">
                    <span class="badge badge-${ticket.priority || 'medium'}">${(ticket.priority || 'MEDIUM').toUpperCase()}</span>
                    <span class="badge badge-${ticket.level?.toLowerCase() || 'l1'}">${ticket.level || 'L1'}</span>
                </div>
            </div>
            
            ${ticket.helpfulNotes ? `
            <div class="ticket-info">
                <h3>🤖 AI Analysis & Notes</h3>
                <p style="white-space: pre-wrap;">${ticket.helpfulNotes}</p>
            </div>
            ` : ''}
            
            <div class="cta">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/tickets/${ticket._id}">View Ticket Details</a>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    await sendMail(assignedUser.email, subject, text, html);
    console.log(`✅ Ticket assignment email sent to: ${assignedUser.email}`);

  } catch (error) {
    console.error('❌ Failed to send ticket assignment email:', error.message);
  }
};