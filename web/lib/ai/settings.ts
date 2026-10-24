// AI settings and credentials. Everything lives only in this browser:
//  - settings (provider, model, preferences) in localStorage - nothing secret
//  - API keys and endpoints/regions encrypted (vault.ts), on this device or for this session only
import { useSyncExternalStore } from "react";
import { jsonStore, useStore } from "../localstore";
import type { Connection } from "./client";
import { type ProviderId, PROVIDERS, providerById } from "./providers";
import { type Envelope, type Protection, Vault, VaultError, cryptoAvailable, isEnvelope, openLegacyBlob } from "./vault";

export type AISettings = {
  provider: ProviderId;
  models: Partial<Record<ProviderId, string>>;
  remember: boolean;
  shareContext: boolean;
  contextChars: number | null; // null = provider default
  configured: boolean; // the learner has completed setup (a successful test, or pressed Done)
  azureApiVersion: string;
  protection: Protection; // how saved keys are encrypted: with a device key, or a passphrase
};

const DEFAULTS: AISettings = { provider: "ollama", models: {}, remember: true, shareContext: true, contextChars: null, configured: false, azureApiVersion: "2024-10-21", protection: "device" };

export const settingsStore = jsonStore<AISettings>("rag30-ai-settings", DEFAULTS);
export const useAISettings = () => useStore(settingsStore);

// -------------------------------------------------------------------------------- encrypted credentials
// API keys and endpoints/regions are stored only as an encrypted envelope (see vault.ts), in localStorage ("on this
// device") and/or sessionStorage ("this session only"). Two protection modes:
//   "device"      the key is a non-extractable browser key; nothing to type, ever.
//   "passphrase"  the key is derived from a passphrase you type once per browser session.
// Decrypted values live in memory only while the page is open.

type Keys = Partial<Record<ProviderId, string>>;
type Urls = Partial<Record<ProviderId, string>>;
type Creds = { keys: Keys; urls: Urls };
export type VaultStatus = "loading" | "ready" | "locked";
type VaultState = { status: VaultStatus; secure: boolean; keys: Keys; urls: Urls; error: string };

const DEVICE_SLOT = "rag30-credentials";
const SESSION_SLOT = "rag30-credentials-session";
const FIRST_RELEASE_SLOTS = ["rag30-vault-device", "rag30-vault-session"]; // "v1.<iv>.<ct>" strings
const PLAINTEXT_KEYS = "rag30-ai-keys"; // from before any encryption

const vault = new Vault();
const EMPTY: VaultState = { status: "loading", secure: true, keys: {}, urls: {}, error: "" };
let state: VaultState = EMPTY;
let device: Creds = { keys: {}, urls: {} };
let session: Creds = { keys: {}, urls: {} };
let locked: Envelope[] = []; // passphrase envelopes waiting for the passphrase
let initStarted = false;
const listeners = new Set<() => void>();

const merged = (): Pick<VaultState, "keys" | "urls"> => ({ keys: { ...device.keys, ...session.keys }, urls: { ...device.urls, ...session.urls } });
const publish = (patch: Partial<VaultState> = {}) => {
  state = { ...state, ...merged(), ...patch };
  listeners.forEach((l) => l());
};
const hasData = (c: Creds) => Object.keys(c.keys).length > 0 || Object.keys(c.urls).length > 0;
const readEnvelope = (store: Storage, slot: string): Envelope | null => {
  try {
    const parsed = JSON.parse(store.getItem(slot) ?? "null");
    return isEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
};
const parseCreds = (text: string | null): Creds => {
  try {
    const c = JSON.parse(text ?? "null") as Partial<Creds> | null;
    return { keys: c?.keys ?? {}, urls: c?.urls ?? {} };
  } catch {
    return { keys: {}, urls: {} };
  }
};
const parseLegacyKeys = (raw: string | null): Keys => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const protection = (): Protection => settingsStore.get().protection;

/** Encrypts both slots with the current protection mode. Never writes credentials unencrypted. */
async function save() {
  if (!cryptoAvailable()) return;
  const mode = protection();
  const put = async (store: Storage, slot: string, c: Creds) => {
    if (hasData(c) || mode === "passphrase") store.setItem(slot, JSON.stringify(await vault.seal(JSON.stringify(c), mode)));
    else store.removeItem(slot);
  };
  try {
    if (mode === "passphrase" && !vault.hasPassphraseSession()) return; // can't encrypt until unlocked
    await put(localStorage, DEVICE_SLOT, device);
    await put(sessionStorage, SESSION_SLOT, session);
  } catch (e) {
    publish({ error: e instanceof Error ? e.message : "Couldn't save." }); // storage blocked: credentials stay in memory
  }
}

async function openSlots(envs: { env: Envelope; target: "device" | "session" }[], passphrase?: string) {
  let first = true;
  for (const { env, target } of envs) {
    const creds = parseCreds(await vault.open(env, first ? passphrase : undefined));
    first = false;
    if (target === "device") device = creds;
    else session = creds;
  }
}

function init() {
  if (initStarted || typeof window === "undefined") return;
  initStarted = true;
  void (async () => {
    const secure = cryptoAvailable();
    try {
      const envs = [
        { env: readEnvelope(localStorage, DEVICE_SLOT), target: "device" as const },
        { env: readEnvelope(sessionStorage, SESSION_SLOT), target: "session" as const },
      ].filter((e): e is { env: Envelope; target: "device" | "session" } => e.env !== null);

      if (secure && envs.some((e) => e.env.mode === "passphrase")) {
        locked = envs.map((e) => e.env);
        publish({ status: "locked", secure });
        return;
      }
      if (secure) {
        try {
          await openSlots(envs);
        } catch (e) {
          publish({ error: e instanceof VaultError ? e.message : "" }); // lost device key or damaged data: start empty
        }
        // first release (before envelopes): same device key, older format
        const [dBlob, sBlob] = FIRST_RELEASE_SLOTS.map((k) => (k === FIRST_RELEASE_SLOTS[0] ? localStorage : sessionStorage).getItem(k));
        const [oldDevice, oldSession] = await Promise.all([openLegacyBlob(dBlob), openLegacyBlob(sBlob)]);
        if (oldDevice) device = mergeCreds(parseCreds(oldDevice), device);
        if (oldSession) session = mergeCreds(parseCreds(oldSession), session);
      }
      // plaintext from the earliest versions
      const raw = localStorage.getItem("rag30-ai-settings");
      const oldUrls: Urls = raw ? (JSON.parse(raw).baseUrls ?? {}) : {};
      const oldKeys = { ...parseLegacyKeys(localStorage.getItem(PLAINTEXT_KEYS)), ...parseLegacyKeys(sessionStorage.getItem(PLAINTEXT_KEYS)) };
      const migrated = Object.keys(oldKeys).length > 0 || Object.keys(oldUrls).length > 0;
      if (migrated) device = mergeCreds({ keys: oldKeys, urls: oldUrls }, device);
      publish({ status: "ready", secure });
      if (secure && (migrated || oldDeviceOrSession(FIRST_RELEASE_SLOTS))) {
        await save();
        for (const k of FIRST_RELEASE_SLOTS) {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        }
        localStorage.removeItem(PLAINTEXT_KEYS);
        sessionStorage.removeItem(PLAINTEXT_KEYS);
        if (raw) {
          const cleaned = JSON.parse(raw);
          delete cleaned.baseUrls;
          localStorage.setItem("rag30-ai-settings", JSON.stringify(cleaned));
        }
      }
    } catch {
      publish({ status: "ready", secure });
    }
  })();
}
const mergeCreds = (older: Creds, newer: Creds): Creds => ({ keys: { ...older.keys, ...newer.keys }, urls: { ...older.urls, ...newer.urls } });
const oldDeviceOrSession = (slots: string[]) => slots.some((k) => localStorage.getItem(k) || sessionStorage.getItem(k));

const subscribeVault = (l: () => void) => {
  init();
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function useAIVault(): VaultState {
  return useSyncExternalStore(subscribeVault, () => state, () => EMPTY);
}
export const useAIKeys = () => useAIVault().keys;

/** Opens passphrase-protected credentials. Throws a VaultError ("wrong-passphrase" ...) on failure. */
export async function unlockVault(passphrase: string) {
  const envs = [
    { env: readEnvelope(localStorage, DEVICE_SLOT), target: "device" as const },
    { env: readEnvelope(sessionStorage, SESSION_SLOT), target: "session" as const },
  ].filter((e): e is { env: Envelope; target: "device" | "session" } => e.env !== null);
  await openSlots(envs, passphrase);
  locked = [];
  publish({ status: "ready", error: "" });
}

/** Forgets the passphrase and the decrypted credentials from memory (they stay encrypted in storage). */
export function lockVault() {
  vault.lock();
  device = { keys: {}, urls: {} };
  session = { keys: {}, urls: {} };
  publish({ status: "locked" });
}

/** Switches protection. Going to "passphrase" needs the new passphrase; going back to "device" needs the vault unlocked. */
export async function setProtection(mode: Protection, passphrase?: string) {
  if (mode === "passphrase") {
    if (!passphrase || passphrase.length < 8) throw new VaultError("locked", "Use a passphrase of at least 8 characters.");
    await vault.seal("{}", "passphrase", passphrase); // new salt + key for this session
  }
  settingsStore.set((s) => ({ ...s, protection: mode }));
  if (mode === "device") vault.lock();
  await save();
  publish({ error: "" });
}

/** Saves (or, with an empty key, removes) one provider's key and endpoint, encrypted. */
export function saveCredentials(provider: ProviderId, key: string, url: string | undefined, remember: boolean) {
  for (const c of [device, session]) {
    delete c.keys[provider];
    delete c.urls[provider];
  }
  const target = remember ? device : session;
  if (key) target.keys[provider] = key;
  if (url) target.urls[provider] = url;
  publish();
  void save();
}

/** Removes every stored credential, destroys the device key and forgets any passphrase. */
export function forgetAllKeys() {
  device = { keys: {}, urls: {} };
  session = { keys: {}, urls: {} };
  locked = [];
  try {
    for (const k of [DEVICE_SLOT, ...FIRST_RELEASE_SLOTS, PLAINTEXT_KEYS]) localStorage.removeItem(k);
    for (const k of [SESSION_SLOT, ...FIRST_RELEASE_SLOTS, PLAINTEXT_KEYS]) sessionStorage.removeItem(k);
  } catch {
    /* storage blocked */
  }
  settingsStore.set((s) => ({ ...s, protection: "device" }));
  void vault.destroy();
  publish({ status: "ready", error: "" });
}

/** Move every credential between "this device" and "this session" when the learner flips the switch. */
export function moveKeys(remember: boolean) {
  const all = merged();
  device = remember ? all : { keys: {}, urls: {} };
  session = remember ? { keys: {}, urls: {} } : all;
  publish();
  void save();
}

// ------------------------------------------------------------------------------------- connection

export function buildConnection(s: AISettings, keys: Keys, provider: ProviderId = s.provider, urls: Urls = state.urls, server: ServerKeys = NO_SERVER_KEYS): Connection {
  const p = providerById(provider);
  const viaServer = provider === "openai" || provider === "anthropic" || provider === "azure" ? server[provider] : false;
  return {
    viaServer,
    provider,
    kind: p.kind,
    baseUrl: urls[provider] || p.baseUrl,
    apiKey: keys[provider] ?? "",
    model: viaServer && provider === "azure" ? "from .env" : (s.models[provider] ?? p.defaultModel),
    apiVersion: s.azureApiVersion,
  };
}

// ----------------------------------------------------------------------------- local-only providers

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1"];
const subscribeNever = () => () => {};

/** True when the app is being served from this machine. Some providers (Azure OpenAI) are only offered then. */
export function useIsLocal(): boolean {
  return useSyncExternalStore(subscribeNever, () => LOCAL_HOSTS.includes(window.location.hostname), () => false);
}

/** Providers this page may offer: everything on localhost, everything except local-only ones elsewhere. */
export function availableProviders(isLocal: boolean) {
  return PROVIDERS.filter((p) => isLocal || !p.localOnly);
}

export function isReady(c: Connection): boolean {
  const p = providerById(c.provider);
  return !!c.model && (!p.needsKey || !!c.apiKey || !!c.viaServer);
}

export const contextBudget = (s: AISettings) => s.contextChars ?? providerById(s.provider).contextChars;

/** Hook: the active connection plus whether it is ready to use. */
export function useConnection() {
  const settings = useAISettings();
  const { keys, urls, status, secure } = useAIVault();
  const isLocal = useIsLocal();
  const server = useServerKeys();
  const connection = buildConnection(settings, keys, settings.provider, urls, server);
  const allowed = isLocal || !providerById(settings.provider).localOnly; // a saved Azure choice is ignored on a hosted copy
  return { settings, keys, urls, secure, status, server, connection, ready: status === "ready" && allowed && (settings.configured || connection.viaServer === true) && isReady(connection) };
}

export { PROVIDERS };

// ------------------------------------------------------------------------------- keys held in .env (local only)
// The local app can keep keys in the repository's .env and attach them on the server (server/ai-relay.ts). Asking which
// providers are configured returns booleans only. The hosted static copy has no server, so it never asks.

export type ServerKeys = { openai: boolean; anthropic: boolean; azure: boolean };
const NO_SERVER_KEYS: ServerKeys = { openai: false, anthropic: false, azure: false };
let serverKeys: ServerKeys = NO_SERVER_KEYS;
let serverProbe = false;
const serverListeners = new Set<() => void>();

function probeServerKeys() {
  if (serverProbe || typeof window === "undefined") return;
  serverProbe = true;
  if (process.env.NEXT_PUBLIC_STATIC_EXPORT === "1" || !LOCAL_HOSTS.includes(window.location.hostname)) return; // localhost only
  fetch("/api/ai-server", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((k: Partial<ServerKeys> | null) => {
      if (!k) return;
      serverKeys = { openai: !!k.openai, anthropic: !!k.anthropic, azure: !!k.azure };
      serverListeners.forEach((l) => l());
    })
    .catch(() => {});
}

export function useServerKeys(): ServerKeys {
  return useSyncExternalStore(
    (l) => {
      probeServerKeys();
      serverListeners.add(l);
      return () => void serverListeners.delete(l);
    },
    () => serverKeys,
    () => NO_SERVER_KEYS,
  );
}
