const GIS_SRC = 'https://accounts.google.com/gsi/client';

let loader: Promise<typeof google.accounts> | null = null;

async function loadGoogleAccounts(): Promise<typeof google.accounts> {
  if (loader) {
    return loader;
  }

  loader = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Identity Services can only be used in the browser.'));
      return;
    }

    if (window.google?.accounts) {
      resolve(window.google.accounts);
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts) {
        resolve(window.google.accounts);
      } else {
        reject(new Error('Google Identity Services failed to initialize.'));
      }
    };
    script.onerror = () => {
      reject(new Error('Failed to load Google Identity Services script.'));
    };
    document.head.appendChild(script);
  });

  return loader;
}

export interface GoogleTokenRequestOptions {
  clientId: string;
  scope: string;
  interactive: boolean;
  hint?: string;
  signal?: AbortSignal;
}

export interface GoogleToken {
  accessToken: string;
  expiresIn: number;
  scope: string;
}

export async function requestGoogleToken(
  options: GoogleTokenRequestOptions,
): Promise<GoogleToken> {
  const accounts = await loadGoogleAccounts();

  return new Promise<GoogleToken>((resolve, reject) => {
    let completed = false;

    const client = accounts.oauth2.initTokenClient({
      client_id: options.clientId,
      scope: options.scope,
      hint: options.hint,
      callback: (response) => {
        if (completed) {
          return;
        }

        if ('error' in response && response.error) {
          completed = true;
          reject(new Error(response.error));
          return;
        }

        completed = true;
        resolve({
          accessToken: response.access_token,
          expiresIn: Number(response.expires_in ?? 0),
          scope: response.scope ?? options.scope,
        });
      },
      error_callback: (error) => {
        if (completed) {
          return;
        }
        completed = true;
        reject(new Error(error.type ?? 'google_identity_error'));
      },
    });

    options.signal?.addEventListener(
      'abort',
      () => {
        if (!completed) {
          completed = true;
          reject(new Error('Google token request aborted.'));
        }
      },
      { once: true },
    );

    try {
      client.requestAccessToken({
        prompt: options.interactive ? 'consent' : '',
      });
    } catch (error) {
      completed = true;
      reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  });
}
