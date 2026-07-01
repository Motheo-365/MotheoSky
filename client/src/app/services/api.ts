import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;
//Encode username:password to Base64

async function parseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned invalid JSON: ${text}`);
  }
}

export async function login(username: string, password: string) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "Login",
      username,
      password
    })
  });

  if (!res.ok) {
    const text = await res.text();
    let payload: any = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

    const errorText = typeof payload?.data === 'string'
      ? payload.data
      : payload?.message ?? text;

    throw new Error(errorText || `Login failed (${res.status})`);
  }

  return await parseJsonResponse(res);
}

export async function me(apiKey: string) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "Me",
      api_key: apiKey
    })
  });

  return await parseJsonResponse(res);
}

export async function getFlights(apiKey: string) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "GetAllFlights",
      api_key: apiKey
    })
  });

  return await parseJsonResponse(res);
}
