export const BROWSER_PUSH_KEY = 'mullah_browser_push';

export function isBrowserPushEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(BROWSER_PUSH_KEY) === 'true' && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

export async function requestBrowserPushPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  try {
    const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    localStorage.setItem(BROWSER_PUSH_KEY, result === 'granted' ? 'true' : 'false');
    return result === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export function disableBrowserPush(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BROWSER_PUSH_KEY, 'false');
  } catch {
    // ignore
  }
}

export function sendBrowserPushNotification(title: string, body: string): void {
  if (!isBrowserPushEnabled()) return;
  try {
    new Notification(title, {
      body,
      tag: `njia-${title.slice(0, 24)}`,
    });
  } catch {
    // Ignore browser notification exceptions
  }
}

export function getSavedAlertChannels(): {
  telegramToken: string;
  telegramChatId: string;
  discordWebhook: string;
  autoBroadcast: boolean;
} {
  if (typeof window === 'undefined') {
    return { telegramToken: '', telegramChatId: '', discordWebhook: '', autoBroadcast: false };
  }
  try {
    return {
      telegramToken: localStorage.getItem('mullah_tg_token') || '',
      telegramChatId: localStorage.getItem('mullah_tg_chat_id') || '',
      discordWebhook: localStorage.getItem('mullah_discord_webhook') || '',
      autoBroadcast: localStorage.getItem('mullah_auto_broadcast') === 'true',
    };
  } catch {
    return { telegramToken: '', telegramChatId: '', discordWebhook: '', autoBroadcast: false };
  }
}

export async function relayExternalAlert(params: {
  message: string;
  telegramToken?: string;
  telegramChatId?: string;
  discordWebhook?: string;
}): Promise<{ success: boolean; telegramSent: boolean; discordSent: boolean }> {
  const saved = getSavedAlertChannels();
  const telegramToken = params.telegramToken ?? saved.telegramToken;
  const telegramChatId = params.telegramChatId ?? saved.telegramChatId;
  const discordWebhook = params.discordWebhook ?? saved.discordWebhook;

  if (!telegramToken && !discordWebhook) {
    return { success: false, telegramSent: false, discordSent: false };
  }

  try {
    const resp = await fetch('/api/alerts/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: params.message,
        telegramToken,
        telegramChatId,
        discordWebhook,
      }),
    });
    if (!resp.ok) return { success: false, telegramSent: false, discordSent: false };
    const data = await resp.json();
    return {
      success: Boolean(data.success),
      telegramSent: Boolean(data.telegramSent),
      discordSent: Boolean(data.discordSent),
    };
  } catch {
    return { success: false, telegramSent: false, discordSent: false };
  }
}

export async function syncDaemonAlertChannels(): Promise<void> {
  const saved = getSavedAlertChannels();
  try {
    await fetch('/api/ea/daemon-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramToken: saved.telegramToken,
        telegramChatId: saved.telegramChatId,
        discordWebhook: saved.discordWebhook,
      }),
    });
  } catch {
    // ignore sync error when offline
  }
}
