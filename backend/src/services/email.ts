import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendOTP(email: string, otp: string): Promise<void> {
  await transporter.sendMail({
    from: `"UdhaariBook" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Your UdhaariBook Login OTP',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#6366f1;margin-bottom:8px;">UdhaariBook</h2>
        <p style="color:#374151;font-size:16px;">Your one-time password (OTP) for login:</p>
        <div style="background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">
          <span style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#1f2937;">${otp}</span>
        </div>
        <p style="color:#6b7280;font-size:14px;">This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">UdhaariBook — Your digital khata, always with you.</p>
      </div>
    `,
  });
}

export async function sendInvoiceEmail(
  toEmail: string,
  toName: string,
  merchantName: string,
  invoicePdfBuffer: Buffer,
  invoiceNumber: string,
  amount: number
): Promise<void> {
  await transporter.sendMail({
    from: `"${merchantName} via UdhaariBook" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `Invoice ${invoiceNumber} from ${merchantName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#6366f1;">Invoice from ${merchantName}</h2>
        <p style="color:#374151;font-size:16px;">Namaste <strong>${toName}</strong> ji 🙏</p>
        <p style="color:#374151;">
          <strong>${merchantName}</strong> ne aapko ek invoice bheja hai. Please find the attached PDF.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
          <p style="margin:0;color:#166534;font-size:14px;">Invoice Amount</p>
          <p style="margin:8px 0 0;font-size:32px;font-weight:bold;color:#15803d;">₹${amount.toLocaleString('en-IN')}</p>
          <p style="margin:4px 0 0;color:#166534;font-size:12px;">Invoice # ${invoiceNumber}</p>
        </div>
        <p style="color:#6b7280;font-size:14px;">Koi sawaal ho toh seedha reply kar sakte hain. Shukriya! 🙏</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">Sent via UdhaariBook — Digital Khata Management</p>
      </div>
    `,
    attachments: [
      {
        filename: `Invoice_${invoiceNumber}.pdf`,
        content: invoicePdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

export async function sendStaffInvite(
  staffEmail: string,
  merchantBusinessName: string,
  role: string,
  inviteToken: string
): Promise<void> {
  const appUrl = process.env.FRONTEND_URL?.split(',')[0] ?? 'http://localhost:5173';
  const inviteLink = `${appUrl}/staff-invite?token=${inviteToken}`;
  await transporter.sendMail({
    from: `"UdhaariBook" <${process.env.GMAIL_USER}>`,
    to: staffEmail,
    subject: `You've been invited to join ${merchantBusinessName} on UdhaariBook`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#6366f1;">Staff Invitation</h2>
        <p style="color:#374151;font-size:16px;">Namaste! 🙏</p>
        <p style="color:#374151;">
          <strong>${merchantBusinessName}</strong> ne aapko UdhaariBook par <strong>${role}</strong> ke roop mein join karne ka invitation bheja hai.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${inviteLink}" style="background:#6366f1;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;display:inline-block;">
            Accept Invitation
          </a>
        </div>
        <p style="color:#6b7280;font-size:14px;">Yeh invitation 48 ghante tak valid hai.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">UdhaariBook — Your digital khata, always with you.</p>
      </div>
    `,
  });
}

export async function sendReminder(
  customerEmail: string,
  customerName: string,
  merchantName: string,
  amount: number,
  paymentLink?: string
): Promise<void> {
  await transporter.sendMail({
    from: `"${merchantName} via UdhaariBook" <${process.env.GMAIL_USER}>`,
    to: customerEmail,
    subject: `Payment Reminder from ${merchantName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#6366f1;">Payment Reminder</h2>
        <p style="color:#374151;font-size:16px;">Namaste <strong>${customerName}</strong> ji 🙏</p>
        <p style="color:#374151;">
          <strong>${merchantName}</strong> ki taraf se ek choti si yaad dila raha hoon.
        </p>
        <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
          <p style="margin:0;color:#92400e;font-size:14px;">Outstanding Balance</p>
          <p style="margin:8px 0 0;font-size:32px;font-weight:bold;color:#b45309;">₹${amount.toLocaleString('en-IN')}</p>
        </div>
        ${
          paymentLink
            ? `<div style="text-align:center;margin:24px 0;">
            <a href="${paymentLink}" style="background:#6366f1;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;display:inline-block;">
              Pay Now
            </a>
          </div>`
            : ''
        }
        <p style="color:#6b7280;font-size:14px;">Jab bhi convenient ho, payment kar sakte hain. Shukriya! 🙏</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">Sent via UdhaariBook — Digital Khata Management</p>
      </div>
    `,
  });
}
