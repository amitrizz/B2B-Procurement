import jwt from 'jsonwebtoken';

export function generateCentrifugoToken(userId: string) {
  const CENTRIFUGO_HMAC_SECRET = process.env.CENTRIFUGO_TOKEN_HMAC_SECRET_KEY || '';
  
  if (!CENTRIFUGO_HMAC_SECRET) {
    console.warn('CENTRIFUGO_TOKEN_HMAC_SECRET_KEY is missing');
    return '';
  }
  return jwt.sign({ sub: userId }, CENTRIFUGO_HMAC_SECRET, { expiresIn: '1d' });
}

export async function publishToCentrifugo(channel: string, data: any) {
  const CENTRIFUGO_URL = (process.env.CENTRIFUGO_URL || 'http://localhost:8000').replace(/\/$/, '');
  const CENTRIFUGO_API_KEY = process.env.CENTRIFUGO_API_KEY || '';
  
  if (!CENTRIFUGO_API_KEY) {
    console.warn('Centrifugo API Key is not set, skipping publish');
    return false;
  }

  try {
    const response = await fetch(`${CENTRIFUGO_URL}/api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `apikey ${CENTRIFUGO_API_KEY}`
      },
      body: JSON.stringify({
        method: 'publish',
        params: {
          channel,
          data
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Centrifugo] publish failed (${response.status}):`, errText || response.statusText);
      return false;
    }
    console.log(`[Centrifugo] successfully published event to channel: ${channel}`);
    return true;
  } catch (error) {
    console.error('Centrifugo publish error:', error);
    return false;
  }
}
