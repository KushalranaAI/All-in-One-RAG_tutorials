// The AI back-ends a learner can connect. All calls are made directly from their browser to the provider they pick -
// the course server never sees prompts or keys.

export type ProviderId = "ollama" | "anthropic" | "openai" | "azure" | "gemini" | "custom";
export type ProviderKind = "openai" | "anthropic" | "gemini" | "azure";

export type Provider = {
  id: ProviderId;
  label: string;
  tagline: string;
  kind: ProviderKind;
  local: boolean;
  baseUrl: string;
  editableBaseUrl: boolean;
  needsKey: boolean;
  keyLabel: string;
  keyUrl?: string;
  defaultModel: string;
  /** Default amount of lesson text sent along with a question. Small local models have small context windows. */
  contextChars: number;
  setup: string;
  /** Only offered when the app runs on this machine (localhost), not on a hosted copy such as GitHub Pages. */
  localOnly?: boolean;
  baseLabel?: string;
  basePlaceholder?: string;
  modelLabel?: string;
  modelHelp?: string;
};

export const PROVIDERS: Provider[] = [
  {
    id: "ollama",
    label: "Ollama",
    tagline: "Runs on your computer. Free, private, works offline.",
    kind: "openai",
    local: true,
    baseUrl: "http://localhost:11434/v1",
    editableBaseUrl: true,
    needsKey: false,
    keyLabel: "",
    defaultModel: "llama3.2",
    contextChars: 4000,
    setup: "Install Ollama from ollama.com, then run `ollama pull llama3.2` in a terminal. Leave Ollama running.",
  },
  {
    id: "custom",
    label: "Local server / other",
    tagline: "LM Studio, llama.cpp, vLLM … any OpenAI-compatible server running on this computer.",
    kind: "openai",
    local: true,
    baseUrl: "http://localhost:1234/v1",
    editableBaseUrl: true,
    needsKey: false,
    keyLabel: "API key (only if the server needs one)",
    defaultModel: "",
    contextChars: 6000,
    setup: "In LM Studio start the local server (Developer tab) and enable CORS. Paste the server's base URL here. For safety the app only connects to servers on localhost / 127.0.0.1.",
  },
  {
    id: "anthropic",
    label: "Claude (Anthropic)",
    tagline: "Strongest explanations. Needs an API key.",
    kind: "anthropic",
    local: false,
    baseUrl: "https://api.anthropic.com",
    editableBaseUrl: false,
    needsKey: true,
    keyLabel: "Anthropic API key",
    keyUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-sonnet-5-5",
    contextChars: 16000,
    setup: "Create a key in the Anthropic console. Usage is billed to your account.",
  },
  {
    id: "openai",
    label: "OpenAI",
    tagline: "GPT models. Needs an API key.",
    kind: "openai",
    local: false,
    baseUrl: "https://api.openai.com/v1",
    editableBaseUrl: false,
    needsKey: true,
    keyLabel: "OpenAI API key",
    keyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o-mini",
    contextChars: 16000,
    setup: "Create a key on the OpenAI platform. Usage is billed to your account.",
  },
  {
    id: "azure",
    label: "Azure OpenAI",
    tagline: "Your own Azure deployment. Offered only when running locally.",
    kind: "azure",
    local: false,
    localOnly: true,
    baseUrl: "",
    editableBaseUrl: true,
    baseLabel: "Azure OpenAI endpoint",
    basePlaceholder: "https://YOUR-RESOURCE.openai.azure.com",
    needsKey: true,
    keyLabel: "Azure OpenAI API key",
    keyUrl: "https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI",
    defaultModel: "",
    modelLabel: "Deployment name",
    modelHelp: "The name you gave the deployment in Azure AI Foundry (not the model name).",
    contextChars: 16000,
    setup: "In the Azure portal open your Azure OpenAI resource → Keys and Endpoint, copy the endpoint and a key, and note your deployment name. Entra ID sign-in isn't supported, only API keys.",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    tagline: "Gemini models. Has a free tier.",
    kind: "gemini",
    local: false,
    baseUrl: "https://generativelanguage.googleapis.com",
    editableBaseUrl: false,
    needsKey: true,
    keyLabel: "Gemini API key",
    keyUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-2.0-flash",
    contextChars: 16000,
    setup: "Create a key in Google AI Studio.",
  },
];

export const providerById = (id: ProviderId): Provider => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
