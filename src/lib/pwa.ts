// Progressive Web App glue: service-worker registration, install-prompt capture,
// and Web Push subscription. All of it degrades gracefully when unsupported.

import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

// ---------------------------------------------------------------------------
// Service worker
// ---------------------------------------------------------------------------

let swRegistration: ServiceWorkerRegistration | null = null;

/** Register the service worker (production only). Safe to call at startup. */
export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  // Only in production builds — a SW in dev fights Vite's HMR.
  if (!import.meta.env.PROD) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        swRegistration = reg;
      })
      .catch(() => {
        /* SW is an enhancement; ignore failures */
      });
  });
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistration) return swRegistration;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  swRegistration = (await navigator.serviceWorker.ready.catch(() => null)) ?? null;
  return swRegistration;
}

// ---------------------------------------------------------------------------
// Install prompt (Add to Home Screen)
// ---------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installListeners.forEach((fn) => fn(true));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installListeners.forEach((fn) => fn(false));
  });
}

/** Whether the browser is currently offering an install. */
export function canInstall(): boolean {
  return deferredPrompt !== null;
}

/** Subscribe to install-availability changes; returns an unsubscribe fn. */
export function onInstallAvailabilityChange(fn: (canInstall: boolean) => void): () => void {
  installListeners.add(fn);
  return () => installListeners.delete(fn);
}

/** Show the native install prompt. Returns true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installListeners.forEach((fn) => fn(false));
  return outcome === "accepted";
}

/** Already running as an installed standalone app? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// ---------------------------------------------------------------------------
// Web Push
//
// The subscription is stored in Supabase (push_subscriptions). Actually *sending*
// a push requires a VAPID keypair + a small edge function using the `web-push`
// library — this file owns the client half so that server piece can be added
// later without touching the UI.
// ---------------------------------------------------------------------------

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC_KEY
  );
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Ask for notification permission, subscribe to push, and persist the
 * subscription for the given user. Returns true on success.
 */
export async function enablePush(userId: string): Promise<boolean> {
  if (!pushSupported() || !VAPID_PUBLIC_KEY) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await getRegistration();
  if (!reg) return false;

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
    { onConflict: "endpoint" },
  );
  return !error;
}
