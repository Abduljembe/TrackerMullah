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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getBackgroundWebPushStatus(): Promise<{
  supported: boolean;
  subscribed: boolean;
  permission: NotificationPermission | 'unsupported';
}> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    typeof Notification === 'undefined'
  ) {
    return { supported: false, subscribed: false, permission: 'unsupported' };
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return {
      supported: true,
      subscribed: Boolean(sub),
      permission: Notification.permission,
    };
  } catch {
    return { supported: true, subscribed: false, permission: Notification.permission };
  }
}

export async function subscribeBackgroundWebPush(): Promise<{ ok: boolean; reason?: string }> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    typeof Notification === 'undefined'
  ) {
    return { ok: false, reason: 'Background Web Push is not supported in this browser.' };
  }

  try {
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'Notification permission was denied by the browser.' };
    }
    localStorage.setItem(BROWSER_PUSH_KEY, 'true');

    const keyResp = await fetch('/api/push/vapid-public-key');
    if (!keyResp.ok) return { ok: false, reason: 'Unable to fetch server VAPID public key.' };
    const keyData = await keyResp.json();
    const publicKey = String(keyData?.publicKey || '');
    if (!publicKey) return { ok: false, reason: 'Empty VAPID public key.' };

    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    const subResp = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    if (!subResp.ok) {
      return { ok: false, reason: 'Server rejected push subscription.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Service worker push registration is unavailable in this preview frame.' };
  }
}

export async function unsubscribeBackgroundWebPush(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }
    }
  } catch {
    // ignore cleanup error
  }
}

export async function sendTestBackgroundPush(): Promise<{ ok: boolean; sent: number }> {
  try {
    const resp = await fetch('/api/push/test', { method: 'POST' });
    if (!resp.ok) return { ok: false, sent: 0 };
    const data = await resp.json();
    return { ok: Boolean(data.success), sent: Number(data.sent || 0) };
  } catch {
    return { ok: false, sent: 0 };
  }
}
