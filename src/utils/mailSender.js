import nodemailer from "nodemailer";

export const sendOTPEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"APTDCL" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
};

export const sendMail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"APTDCL" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

// Simple resend OTP method without user info
export const resendOTP = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Simple OTP email template
    const otpHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>OTP Verification</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #279eab; margin: 0; font-size: 28px;">APTDCL</h1>
            </div>

            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #333333; margin: 0 0 10px 0;">OTP Verification</h2>
              <p style="color: #666666; margin: 0; font-size: 16px;">Your verification code has been resent</p>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
              <p style="color: #333333; margin: 0 0 15px 0; font-size: 16px;">Your OTP code is:</p>
              <div style="font-size: 32px; font-weight: bold; color: #279eab; letter-spacing: 8px; margin: 10px 0;">
                ${otp}
              </div>
              <p style="color: #666666; margin: 15px 0 0 0; font-size: 14px;">This code will expire in 10 minutes</p>
            </div>

            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin-bottom: 20px;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>Security Note:</strong> Do not share this OTP with anyone. APTDCL will never ask for your OTP via phone or email.
              </p>
            </div>

            <div style="text-align: center; color: #666666; font-size: 12px; border-top: 1px solid #eeeeee; padding-top: 20px;">
              <p style="margin: 0;">If you didn't request this OTP, please ignore this email or contact support.</p>
              <p style="margin: 10px 0 0 0;">&copy; 2025 APTDCL. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: `"APTDCL" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code - APTDCL Verification",
      html: otpHTML,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("OTP resent successfully:", info.messageId);
    return {
      success: true,
      messageId: info.messageId,
      message: "OTP resent successfully",
    };
  } catch (error) {
    console.error("Error resending OTP:", error);
    throw error;
  }
};

// Alternative minimal version (if you prefer a simpler template)
export const resendOTPSimple = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const simpleHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #279eab; text-align: center;">APTDCL - OTP Verification</h2>
        <p>Your verification code has been resent:</p>
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0; border-radius: 5px;">
          ${otp}
        </div>
        <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
      </div>
    `;

    const mailOptions = {
      from: `"APTDCL" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "OTP Verification - APTDCL",
      html: simpleHTML,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("OTP resent successfully:", info.messageId);
    return {
      success: true,
      messageId: info.messageId,
      message: "OTP resent successfully",
    };
  } catch (error) {
    console.error("Error resending OTP:", error);
    throw error;
  }
};
