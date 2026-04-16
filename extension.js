const vscode = require('vscode');

const VIEW_ID = 'aryxChatView';
const COMMAND_FOCUS = 'aryxChat.focus';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const provider = new AryxChatViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_FOCUS, async () => {
      await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
    })
  );
}

class AryxChatViewProvider {
  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this.context = context;
    this.extensionUri = context.extensionUri;
  }

  /**
   * @param {vscode.WebviewView} webviewView
   */
  resolveWebviewView(webviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      try {
        if (message?.type === 'openSettings') {
          this._openSettingsTab();
          return;
        }

        if (message?.type === 'getSettings') {
          const settings = this._getSettings();
          webviewView.webview.postMessage({ type: 'settingsLoaded', settings });
          return;
        }

        if (message?.type === 'saveSettings') {
          const nextSettings = normalizeSettings(message.settings);
          await this.context.globalState.update('aryx.settings', nextSettings);
          webviewView.webview.postMessage({ type: 'settingsLoaded', settings: nextSettings });
          return;
        }

        if (message?.type === 'fetchModels') {
          const settings = normalizeSettings(message.settings);
          if (!settings.apiKey) {
            webviewView.webview.postMessage({
              type: 'errorMessage',
              text: 'Please enter an API key first.'
            });
            return;
          }

          const models = await fetchModels(settings.provider, settings.apiKey);
          webviewView.webview.postMessage({ type: 'modelsLoaded', models });

          if (!settings.model && models.length > 0) {
            const autoSettings = { ...settings, model: models[0] };
            await this.context.globalState.update('aryx.settings', autoSettings);
            webviewView.webview.postMessage({ type: 'settingsLoaded', settings: autoSettings });
          }
          return;
        }

        if (message?.type === 'sendMessage') {
          const text = String(message.text || '').trim();
          const settings = normalizeSettings(message.settings);

          if (!text) {
            return;
          }

          if (!settings.apiKey || !settings.model) {
            webviewView.webview.postMessage({
              type: 'errorMessage',
              text: 'Set API key and model in settings.'
            });
            return;
          }

          await this.context.globalState.update('aryx.settings', settings);
          webviewView.webview.postMessage({ type: 'replyStart' });

          const reply = await generateReply(settings, text);

          webviewView.webview.postMessage({ type: 'assistantMessage', text: reply });
          webviewView.webview.postMessage({ type: 'replyEnd' });
          return;
        }
      } catch (error) {
        webviewView.webview.postMessage({
          type: 'replyEnd'
        });
        webviewView.webview.postMessage({
          type: 'errorMessage',
          text: toUserError(error)
        });
      }
    });
  }

  _getSettings() {
    const saved = this.context.globalState.get('aryx.settings');
    return normalizeSettings(saved);
  }

  /**
   * @param {vscode.Webview} webview
   */
  _getHtml(webview) {
    const nonce = getNonce();
    const appScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'main.js')
    );
    const mainCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'main.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <link rel="stylesheet" href="${mainCssUri}?v=${nonce}" />
    <title>Aryx</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${appScriptUri}"></script>
  </body>
</html>`;
  }

  _openSettingsTab() {
    if (this._settingsPanel) {
      this._settingsPanel.reveal(vscode.ViewColumn.One);
      return;
    }

    this._settingsPanel = vscode.window.createWebviewPanel(
      'aryxSettings',
      'Aryx Settings',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [this.extensionUri]
      }
    );

    const webview = this._settingsPanel.webview;
    const nonce = getNonce();

    const appScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'settings.js')
    );
    const settingsCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'settings.css')
    );

    webview.html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; connect-src https://generativelanguage.googleapis.com https://openrouter.ai; img-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <link rel="stylesheet" href="${settingsCssUri}?v=${nonce}" />
    <title>Aryx Settings</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${appScriptUri}"></script>
  </body>
</html>`;

    // Wire up settings panel message handling
    webview.onDidReceiveMessage(async (message) => {
      try {
        if (message?.type === 'getSettings') {
          const settings = this._getSettings();
          webview.postMessage({ type: 'settingsLoaded', settings });
          return;
        }

        if (message?.type === 'saveSettings') {
          const nextSettings = normalizeSettings(message.settings);
          await this.context.globalState.update('aryx.settings', nextSettings);
          webview.postMessage({ type: 'settingsLoaded', settings: nextSettings });
          webview.postMessage({ type: 'settingsSaved' });
          return;
        }

        if (message?.type === 'fetchModels') {
          const settings = normalizeSettings(message.settings);
          if (!settings.apiKey) {
            webview.postMessage({
              type: 'errorMessage',
              text: 'Please enter an API key first.'
            });
            return;
          }

          const models = await fetchModels(settings.provider, settings.apiKey);
          webview.postMessage({ type: 'modelsLoaded', models });
          return;
        }
      } catch (error) {
        webview.postMessage({
          type: 'errorMessage',
          text: toUserError(error)
        });
      }
    }, null, this.context.subscriptions);

    this._settingsPanel.onDidDispose(
      () => {
        this._settingsPanel = undefined;
      },
      null,
      this.context.subscriptions
    );
  }
}

// ─── Settings normalization ───────────────────────────
function normalizeSettings(value) {
  const validProviders = ['google-gemini', 'openrouter'];
  const provider = validProviders.includes(value?.provider) ? value.provider : 'google-gemini';
  return {
    provider,
    apiKey: typeof value?.apiKey === 'string' ? value.apiKey.trim() : '',
    model: typeof value?.model === 'string' ? value.model.trim() : ''
  };
}

// ─── Fetch models (provider-agnostic) ─────────────────
async function fetchModels(provider, apiKey) {
  if (provider === 'openrouter') {
    return fetchOpenRouterModels(apiKey);
  }
  return fetchGeminiModels(apiKey);
}

// ─── Google Gemini models ─────────────────────────────
async function fetchGeminiModels(apiKey) {
  const url = `${GEMINI_API_BASE}/models?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const bodyText = await safeReadText(response);
    throw new Error(`Gemini models fetch failed (${response.status}): ${bodyText}`);
  }

  const data = await response.json();
  const items = Array.isArray(data?.models) ? data.models : [];

  const modelNames = items
    .filter((item) => {
      const name = String(item?.name || '');
      const methods = Array.isArray(item?.supportedGenerationMethods)
        ? item.supportedGenerationMethods
        : [];
      return name.includes('gemini') && methods.includes('generateContent');
    })
    .map((item) => String(item.name || '').replace(/^models\//, ''))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return [...new Set(modelNames)];
}

// ─── OpenRouter models ────────────────────────────────
async function fetchOpenRouterModels(apiKey) {
  const url = `${OPENROUTER_API_BASE}/models`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const bodyText = await safeReadText(response);
    throw new Error(`OpenRouter models fetch failed (${response.status}): ${bodyText}`);
  }

  const data = await response.json();
  const items = Array.isArray(data?.data) ? data.data : [];

  const modelIds = items
    .map((item) => String(item?.id || ''))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return [...new Set(modelIds)];
}

// ─── Generate reply (provider-agnostic) ───────────────
async function generateReply(settings, text) {
  if (settings.provider === 'openrouter') {
    return generateOpenRouterReply(settings, text);
  }
  return generateGeminiReply(settings, text);
}

// ─── Google Gemini reply ──────────────────────────────
async function generateGeminiReply(settings, text) {
  const modelId = settings.model.replace(/^models\//, '');
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text }]
        }
      ]
    })
  });

  if (!response.ok) {
    const bodyText = await safeReadText(response);
    throw new Error(`Gemini response failed (${response.status}): ${bodyText}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const reply = Array.isArray(parts)
    ? parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim()
    : '';

  if (!reply) {
    throw new Error('Gemini returned empty response. Try another prompt/model.');
  }

  return reply;
}

// ─── OpenRouter reply ─────────────────────────────────
async function generateOpenRouterReply(settings, text) {
  const url = `${OPENROUTER_API_BASE}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aryx.dev',
      'X-Title': 'Aryx VS Code Extension'
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: 'user',
          content: text
        }
      ]
    })
  });

  if (!response.ok) {
    const bodyText = await safeReadText(response);
    throw new Error(`OpenRouter response failed (${response.status}): ${bodyText}`);
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;

  if (!reply || typeof reply !== 'string' || !reply.trim()) {
    throw new Error('OpenRouter returned empty response. Try another prompt/model.');
  }

  return reply.trim();
}

// ─── Utilities ────────────────────────────────────────
async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return 'Unable to read error body';
  }
}

function toUserError(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unknown error';
}

function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

function deactivate() { }

module.exports = {
  activate,
  deactivate
};
