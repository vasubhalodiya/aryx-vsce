const vscode = require('vscode');

const VIEW_ID = 'aryxChatView';
const COMMAND_FOCUS = 'aryxChat.focus';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

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
              text: 'Please enter Gemini API key first.'
            });
            return;
          }

          const models = await fetchGeminiModels(settings.apiKey);
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
              text: 'Set Gemini API key and model in settings.'
            });
            return;
          }

          await this.context.globalState.update('aryx.settings', settings);
          webviewView.webview.postMessage({ type: 'replyStart' });

          const reply = await generateGeminiReply({
            apiKey: settings.apiKey,
            model: settings.model,
            text
          });

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
      vscode.Uri.joinPath(this.extensionUri, 'media', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'styles.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"
    />
    <link rel="stylesheet" href="${styleUri}" />
    <title>Aryx</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${appScriptUri}"></script>
  </body>
</html>`;
  }
}

function normalizeSettings(value) {
  const provider = value?.provider === 'google-gemini' ? 'google-gemini' : 'google-gemini';
  return {
    provider,
    apiKey: typeof value?.apiKey === 'string' ? value.apiKey.trim() : '',
    model: typeof value?.model === 'string' ? value.model.trim() : ''
  };
}

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

async function generateGeminiReply({ apiKey, model, text }) {
  const modelId = model.replace(/^models\//, '');
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;

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

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
