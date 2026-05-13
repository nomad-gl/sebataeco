/**
 * server/sms.ts
 *
 * SMS notification helper for SEBA AI Studio using Twilio.
 *
 * Configuration is driven entirely by environment variables:
 *   TWILIO_ACCOUNT_SID  — Twilio account SID
 *   TWILIO_AUTH_TOKEN   — Twilio authentication token
 *   TWILIO_PHONE_NUMBER — Twilio phone number to send from
 *
 * All sends are fire-and-forget: errors are logged but never thrown so that a
 * misconfigured Twilio account cannot break the notification flow.
 */

export interface SendSmsResult {
  sent: boolean;
  twilioNotConfigured: boolean;
  error?: string;
}

/**
 * Send SMS notification to teacher.
 * Returns a result object — never throws.
 */
export async function sendSmsNotification(opts: {
  to: string;
  message: string;
}): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn("[SMS] Twilio not configured — skipping SMS notification.");
    return { sent: false, twilioNotConfigured: true };
  }

  try {
    // Twilio SDK would be used here if installed
    // For now, we'll use a simple HTTP request to Twilio API
    const response = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Messages.json", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(accountSid + ":" + authToken).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: opts.to,
        Body: opts.message,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio API error: ${response.status} ${error}`);
    }

    console.log(`[SMS] Notification sent to ${opts.to}`);
    return { sent: true, twilioNotConfigured: false };
  } catch (err: any) {
    console.error("[SMS] Failed to send SMS notification:", err?.message ?? err);
    return { sent: false, twilioNotConfigured: false, error: err?.message };
  }
}

/**
 * Send SMS notification to multiple teachers.
 * Returns a result object with success/failure counts.
 */
export async function sendBulkSmsNotifications(
  phoneNumbers: string[],
  message: string
): Promise<{ success: boolean; successful: number; failed: number }> {
  const results = await Promise.all(
    phoneNumbers.map((phone) => sendSmsNotification({ to: phone, message }))
  );

  const successful = results.filter((r) => r.sent).length;
  const failed = results.length - successful;

  return { success: true, successful, failed };
}
