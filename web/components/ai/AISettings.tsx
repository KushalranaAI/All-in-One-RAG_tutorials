"use client";
import { useEffect, useState } from "react";
import { clearChats } from "@/lib/ai/chats";
import { listModels } from "@/lib/ai/client";
import type { ProviderId } from "@/lib/ai/providers";
import { availableProviders, buildConnection, forgetAllKeys, isReady, moveKeys, lockVault, saveCredentials, setProtection, settingsStore, useConnection, useIsLocal } from "@/lib/ai/settings";
import Icon from "../ui/Icon";
import UnlockCard from "./UnlockCard";

type Status = { tone: "idle" | "busy" | "ok" | "bad"; message?: string; hint?: string };

export default function AISettings({ onDone }: { onDone: () => void }) {
  const { settings, keys, urls, secure, status: vaultStatus, server, connection } = useConnection();
  const [settingUp, setSettingUp] = useState(false);
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [protectErr, setProtectErr] = useState("");
  const [protectMsg, setProtectMsg] = useState("");
  const isLocal = useIsLocal();
  const offered = availableProviders(isLocal); // Azure OpenAI only shows up when this page is served from localhost
  const provider = offered.find((p) => p.id === settings.provider) ?? offered[0];
  const [apiKey, setApiKey] = useState(keys[provider.id] ?? "");
  const [baseUrl, setBaseUrl] = useState(urls[provider.id] ?? provider.baseUrl);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>({ tone: "idle" });

  // switching provider loads that provider's saved values
  useEffect(() => {
    setApiKey(keys[provider.id] ?? "");
    setBaseUrl(urls[provider.id] ?? provider.baseUrl);
    setModels([]);
    setStatus({ tone: "idle" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id]);

  const update = (patch: Partial<typeof settings>) => settingsStore.set((s) => ({ ...s, ...patch }));

  async function connect() {
    setStatus({ tone: "busy", message: "Connecting…" });
    const key = apiKey.trim();
    const base = baseUrl.trim() || provider.baseUrl;
    saveCredentials(provider.id, key, base === provider.baseUrl ? undefined : base, settings.remember);
    const probe = buildConnection(settings, { [provider.id]: key }, provider.id, { [provider.id]: base }, server); // a key held in .env is never probed from the browser
    try {
      const found = await listModels(probe);
      setModels(found);
      const current = settings.models[provider.id] ?? provider.defaultModel;
      const preferred = found.length && !found.includes(current) ? (found.find((m) => m === provider.defaultModel) ?? found[0]) : current;
      update({ models: { ...settings.models, [provider.id]: preferred }, configured: true });
      setStatus({
        tone: "ok",
        message: fromEnv ? "Ready. The server will use the key in .env." : found.length ? `Connected - ${found.length} models available.` : provider.kind === "azure" ? "Endpoint and key accepted. Now enter your deployment name below." : "Connected, but no models were listed. Type a model name below.",
      });
    } catch (e) {
      const err = e as { message?: string; hint?: string };
      setStatus({ tone: "bad", message: err.message ?? "Could not connect.", hint: err.hint });
    }
  }

  const fromEnv = connection.viaServer === true; // the key for this provider is in .env on this computer
  const model = settings.models[provider.id] ?? provider.defaultModel;
  return (
    <div className="ai-settings">
      <div className="ai-section">
        <h3>Choose your AI</h3>
        <div className="provider-grid" role="radiogroup" aria-label="AI provider">
          {offered.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === provider.id}
              className={`provider ${p.id === provider.id ? "selected" : ""}`}
              onClick={() => update({ provider: p.id as ProviderId })}
            >
              <span className="provider-top">
                <b>{p.label}</b>
                <span className="row" style={{ gap: 4 }}>
                  {(p.id === "openai" || p.id === "anthropic" || p.id === "azure") && server[p.id] && <span className="pill accent">.env</span>}
                  <span className={`pill ${p.local ? "good" : ""}`}>{p.local ? "local" : "cloud"}</span>
                </span>
              </span>
              <span className="muted">{p.tagline}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ai-section">
        <h3>Connect {provider.label}</h3>
        <p className="muted small">{provider.setup}</p>

        {provider.editableBaseUrl && (
          <label className="field">
            <span>{provider.baseLabel ?? "Server address"}</span>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} spellCheck={false} autoComplete="off" placeholder={provider.basePlaceholder ?? provider.baseUrl} />
          </label>
        )}

        {provider.kind === "azure" && (
          <label className="field">
            <span>API version</span>
            <input value={settings.azureApiVersion} onChange={(e) => update({ azureApiVersion: e.target.value })} spellCheck={false} autoComplete="off" placeholder="2024-10-21" />
            <span className="muted small">Leave the default unless your deployment needs a different version.</span>
          </label>
        )}

        {fromEnv && (
          <div className="notice ok" role="status">
            <Icon name="shield" size={16} />
            <div className="small"><b>Using the key in your <code>.env</code> file.</b> It stays on this computer and is attached by the local server; nothing to paste, and nothing is stored in the browser.</div>
          </div>
        )}

        {(provider.needsKey || provider.id === "custom") && !fromEnv && (
          <label className="field">
            <span>
              {provider.keyLabel}
              {provider.keyUrl && (
                <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="field-link">
                  Get a key <Icon name="external" size={12} />
                </a>
              )}
            </span>
            <span className="input-row">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                placeholder={provider.needsKey ? "Paste your key" : "Optional"}
              />
              <button type="button" className="icon-btn" onClick={() => setShowKey(!showKey)} aria-label={showKey ? "Hide key" : "Show key"}>
                <Icon name={showKey ? "eye-off" : "eye"} />
              </button>
            </span>
          </label>
        )}

        <div className="row">
          <button type="button" className="btn primary" onClick={connect} disabled={status.tone === "busy" || (provider.needsKey && !apiKey.trim() && !fromEnv) || (provider.kind === "azure" && !baseUrl.trim())}>
            <Icon name="zap" size={16} /> {status.tone === "busy" ? "Connecting…" : fromEnv ? "Use this key" : provider.needsKey || provider.id === "custom" || provider.editableBaseUrl ? "Save & test connection" : "Test connection"}
          </button>
          {keys[provider.id] && provider.needsKey && (
            <button type="button" className="btn" onClick={() => { saveCredentials(provider.id, "", undefined, settings.remember); setApiKey(""); setStatus({ tone: "idle" }); }}>
              Remove key
            </button>
          )}
        </div>
        {status.message && (
          <div className={`notice ${status.tone}`} role="status">
            <Icon name={status.tone === "ok" ? "circle-check" : status.tone === "bad" ? "alert" : "info"} size={16} />
            <div>
              {status.message}
              {status.hint && <div className="small">{status.hint}</div>}
            </div>
          </div>
        )}

        {fromEnv && provider.kind === "azure" ? (
          <p className="muted small">The deployment comes from <code>AZURE_OPENAI_DEPLOYMENT</code> in your <code>.env</code>.</p>
        ) : (
        <label className="field">
          <span>{provider.modelLabel ?? "Model"}</span>
          <input
            list="ai-models"
            value={model}
            onChange={(e) => update({ models: { ...settings.models, [provider.id]: e.target.value } })}
            spellCheck={false}
            autoComplete="off"
            placeholder={provider.id === "custom" ? "Name of a model your server has loaded" : provider.kind === "azure" ? "e.g. my-gpt-4o" : provider.defaultModel}
          />
          <datalist id="ai-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          <span className="muted small">{provider.modelHelp ?? "Pick from the list after connecting, or type any model name."}</span>
        </label>
        )}
      </div>

      <div className="ai-section">
        <h3>Where your key is stored</h3>
        <div className="choice" role="radiogroup" aria-label="Key storage">
          {[
            { v: true, t: "On this device", d: "Stays in this browser until you remove it." },
            { v: false, t: "This session only", d: "Forgotten when you close the tab." },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              role="radio"
              aria-checked={settings.remember === o.v}
              className={`choice-opt ${settings.remember === o.v ? "selected" : ""}`}
              onClick={() => { update({ remember: o.v }); moveKeys(o.v); }}
            >
              <b>{o.t}</b>
              <span className="muted small">{o.d}</span>
            </button>
          ))}
        </div>
        {secure ? (
          <div className="notice info">
            <Icon name="shield" size={16} />
            <div className="small">
              <b>Encrypted at rest (AES-256-GCM).</b> A copy of the stored data is unreadable on its own. Keys go only to the provider you chose; this app&apos;s server never sees them.
              <br /><b>What it can&apos;t stop:</b> with &quot;this device&quot; protection, anything running in this page, or anyone using your unlocked browser, can still use the saved key. A passphrase fixes the second case but not malicious script while you are using the app. Prefer a key with a spending limit.
            </div>
          </div>
        ) : (
          <div className="notice bad" role="alert">
            <Icon name="alert" size={16} />
            <div className="small">
              <b>Can&apos;t encrypt on this address.</b> Browsers only allow encryption on <code>https://</code> pages and <code>localhost</code>. Your key will be kept in memory for this tab only and never written to storage. Open the app at <code>http://localhost:3000</code> to save it.
            </div>
          </div>
        )}

        {secure && (
          <>
            <h3 style={{ marginTop: 18 }}>How it is protected</h3>
            {vaultStatus === "locked" ? (
              <UnlockCard />
            ) : (
              <>
                <div className="choice" role="radiogroup" aria-label="Protection">
                  {([
                    { v: "device", t: "This device", d: "Nothing to type. A browser-held key you can't read or export." },
                    { v: "passphrase", t: "A passphrase", d: "You type it once per browser session. Without it, nobody can decrypt." },
                  ] as const).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      role="radio"
                      aria-checked={settings.protection === o.v}
                      className={`choice-opt ${settings.protection === o.v ? "selected" : ""}`}
                      onClick={() => {
                        if (o.v === settings.protection) return;
                        if (o.v === "device") void setProtection("device").then(() => setProtectMsg("Now protected by this device's key."));
                        else setSettingUp(true);
                      }}
                    >
                      <b>{o.t}</b>
                      <span className="muted small">{o.d}</span>
                    </button>
                  ))}
                </div>
                {settingUp && (
                  <form
                    className="passphrase-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (pass1.length < 8) return setProtectErr("Use at least 8 characters.");
                      if (pass1 !== pass2) return setProtectErr("The two passphrases don't match.");
                      try {
                        await setProtection("passphrase", pass1);
                        setSettingUp(false);
                        setPass1("");
                        setPass2("");
                        setProtectErr("");
                        setProtectMsg("Passphrase set. You'll be asked for it once per browser session. If you forget it, remove the saved keys and add them again: it can't be recovered.");
                      } catch (err) {
                        setProtectErr(err instanceof Error ? err.message : "Couldn't set the passphrase.");
                      }
                    }}
                  >
                    <label className="field"><span>New passphrase (8+ characters)</span><input type="password" value={pass1} onChange={(e) => setPass1(e.target.value)} autoComplete="new-password" /></label>
                    <label className="field"><span>Type it again</span><input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" /></label>
                    {protectErr && <div className="notice bad" role="alert"><Icon name="alert" size={16} /><div className="small">{protectErr}</div></div>}
                    <div className="row">
                      <button type="submit" className="btn primary"><Icon name="shield" size={16} /> Protect with passphrase</button>
                      <button type="button" className="btn" onClick={() => { setSettingUp(false); setProtectErr(""); setPass1(""); setPass2(""); }}>Cancel</button>
                    </div>
                  </form>
                )}
                {settings.protection === "passphrase" && !settingUp && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <button type="button" className="btn" onClick={() => lockVault()}><Icon name="key" size={16} /> Lock now</button>
                  </div>
                )}
                {protectMsg && <div className="notice ok" role="status"><Icon name="circle-check" size={16} /><div className="small">{protectMsg}</div></div>}
              </>
            )}
          </>
        )}
      </div>

      <div className="ai-section">
        <h3>What the tutor can see</h3>
        <label className="switch-row">
          <input type="checkbox" className="switch" checked={settings.shareContext} onChange={(e) => update({ shareContext: e.target.checked })} />
          <span>
            <b>Share the current page with my questions</b>
            <span className="muted small block">Sends the lesson text / code you are viewing so answers match this course. {provider.local ? "Stays on your computer." : `Goes to ${provider.label}.`}</span>
          </span>
        </label>
        <label className="field">
          <span>Amount of page text to share</span>
          <select value={settings.contextChars ?? ""} onChange={(e) => update({ contextChars: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Automatic for {provider.label} ({provider.contextChars.toLocaleString()} characters)</option>
            <option value="2500">Small - 2,500 (tiny local models)</option>
            <option value="6000">Medium - 6,000</option>
            <option value="16000">Large - 16,000</option>
            <option value="40000">Very large - 40,000 (big-context models)</option>
          </select>
        </label>
      </div>

      <div className="ai-section">
        <h3>Reset</h3>
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            if (!confirm("Remove every saved API key (and its encryption key or passphrase protection) and all saved AI chats from this browser?")) return;
            forgetAllKeys();
            clearChats();
            setApiKey("");
            setStatus({ tone: "idle" });
          }}
        >
          <Icon name="trash" size={16} /> Forget all keys &amp; chats
        </button>
      </div>

      <div className="ai-settings-foot">
        <button type="button" className="btn primary" onClick={() => { update({ configured: true }); onDone(); }} disabled={!isReady(connection)}>
          Done
        </button>
      </div>
    </div>
  );
}
