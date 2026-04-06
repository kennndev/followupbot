import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Start an outbound call to a patient.
 * Twilio will hit our /api/twilio/voice endpoint to get the initial TwiML.
 */
export async function initiateCall(opts: {
  to: string;                // +923001234567
  appointmentId: string;     // encoded in webhook URL so we know which appt
}): Promise<string> {
  const baseUrl = process.env.TWILIO_WEBHOOK_BASE_URL;
  if (!baseUrl) throw new Error('TWILIO_WEBHOOK_BASE_URL missing');

  const call = await client.calls.create({
    to: opts.to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    url: `${baseUrl}/api/twilio/voice?appointmentId=${opts.appointmentId}`,
    statusCallback: `${baseUrl}/api/twilio/status?appointmentId=${opts.appointmentId}`,
    statusCallbackEvent: ['initiated', 'answered', 'completed'],
    // Machine detection: skip voicemails, call again later
    machineDetection: 'Enable',
    asyncAmd: 'true',
    timeout: 20,
  });

  return call.sid;
}

export { client as twilioClient };
