const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');

const VIEW_ID = 'aryxChatView';
const COMMAND_FOCUS = 'aryxChat.focus';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
const OPENAI_API_BASE = 'https://api.openai.com/v1';
const OLLAMA_DEFAULT_BASE = 'http://127.0.0.1:11434';

// ─── File Tools ───────────────────────────────────────────────────────────────

function getWorkspacePath() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
}

function resolvePath(filePath) {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(getWorkspacePath(), filePath);
}

function mkdirForFile(fp) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
}

const TOOL_HANDLERS = {
  create_file: (a) => {
    const fp = resolvePath(a.file_path);
    mkdirForFile(fp);
    if (fs.existsSync(fp)) return `Already exists: ${fp}`;
    fs.writeFileSync(fp, a.content || '', 'utf8');
    return `Created: ${fp}`;
  },
  read_file: (a) => {
    return fs.readFileSync(resolvePath(a.file_path), 'utf8');
  },
  write_file: (a) => {
    const fp = resolvePath(a.file_path);
    mkdirForFile(fp);
    fs.writeFileSync(fp, a.content || '', 'utf8');
    return `Written: ${fp}`;
  },
  append_file: (a) => {
    const fp = resolvePath(a.file_path);
    mkdirForFile(fp);
    fs.appendFileSync(fp, a.content || '', 'utf8');
    return `Appended to: ${fp}`;
  },
  edit_file: (a) => {
    const fp = resolvePath(a.file_path);
    const src = fs.readFileSync(fp, 'utf8');
    if (!src.includes(a.old_text)) return `Text not found in: ${fp}`;
    fs.writeFileSync(fp, src.replace(a.old_text, a.new_text), 'utf8');
    return `Edited: ${fp}`;
  },
  delete_file: (a) => {
    fs.unlinkSync(resolvePath(a.file_path));
    return `Deleted: ${a.file_path}`;
  },
  copy_file: (a) => {
    const dest = resolvePath(a.dest);
    mkdirForFile(dest);
    fs.copyFileSync(resolvePath(a.src), dest);
    return `Copied → ${dest}`;
  },
  move_file: (a) => {
    const dest = resolvePath(a.dest);
    mkdirForFile(dest);
    fs.renameSync(resolvePath(a.src), dest);
    return `Moved → ${dest}`;
  },
  list_files: (a) => {
    const entries = fs.readdirSync(resolvePath(a.dir_path || '.'), { withFileTypes: true });
    return entries.map(e => `${e.isDirectory() ? '[dir] ' : '[file]'} ${e.name}`).join('\n') || '(empty)';
  },
  make_dir: (a) => {
    fs.mkdirSync(resolvePath(a.dir_path), { recursive: true });
    return `Directory created: ${a.dir_path}`;
  },
  delete_dir: (a) => {
    fs.rmSync(resolvePath(a.dir_path), { recursive: true, force: true });
    return `Directory deleted: ${a.dir_path}`;
  },
  file_exists: (a) => {
    return fs.existsSync(resolvePath(a.file_path))
      ? `Exists: ${a.file_path}`
      : `Not found: ${a.file_path}`;
  },
};

function executeTool(name, args) {
  try {
    const handler = TOOL_HANDLERS[name];
    if (!handler) return `Unknown tool: ${name}`;
    return handler(args);
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

// OpenRouter / OpenAI tool format
const FILE_TOOLS = [
  { type: 'function', function: { name: 'create_file', description: 'Create a new file with content (fails if already exists)', parameters: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } } },
  { type: 'function', function: { name: 'read_file', description: 'Read and return the full contents of a file', parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Overwrite a file with new content (creates if missing)', parameters: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } } },
  { type: 'function', function: { name: 'append_file', description: 'Append content to the end of a file', parameters: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } } },
  { type: 'function', function: { name: 'edit_file', description: 'Find old_text in a file and replace it with new_text', parameters: { type: 'object', properties: { file_path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } }, required: ['file_path', 'old_text', 'new_text'] } } },
  { type: 'function', function: { name: 'delete_file', description: 'Delete a single file', parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } } },
  { type: 'function', function: { name: 'copy_file', description: 'Copy a file from src path to dest path', parameters: { type: 'object', properties: { src: { type: 'string' }, dest: { type: 'string' } }, required: ['src', 'dest'] } } },
  { type: 'function', function: { name: 'move_file', description: 'Move or rename a file from src to dest', parameters: { type: 'object', properties: { src: { type: 'string' }, dest: { type: 'string' } }, required: ['src', 'dest'] } } },
  { type: 'function', function: { name: 'list_files', description: 'List files and folders in a directory', parameters: { type: 'object', properties: { dir_path: { type: 'string' } }, required: [] } } },
  { type: 'function', function: { name: 'make_dir', description: 'Create a directory and any missing parent directories', parameters: { type: 'object', properties: { dir_path: { type: 'string' } }, required: ['dir_path'] } } },
  { type: 'function', function: { name: 'delete_dir', description: 'Recursively delete a directory and all its contents', parameters: { type: 'object', properties: { dir_path: { type: 'string' } }, required: ['dir_path'] } } },
  { type: 'function', function: { name: 'file_exists', description: 'Check whether a file or directory exists', parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } } },
];

// Gemini function declarations format
const GEMINI_FUNCTION_DECLARATIONS = FILE_TOOLS.map(t => ({
  name: t.function.name,
  description: t.function.description,
  parameters: {
    type: 'OBJECT',
    properties: Object.fromEntries(
      Object.keys(t.function.parameters.properties).map(k => [k, { type: 'STRING' }])
    ),
    required: t.function.parameters.required,
  },
}));

function getSystemPrompt() {
  const ws = getWorkspacePath();
  return `You are a helpful AI coding assistant with file system access.
Workspace: ${ws}

When the user asks you to read, create, edit, write, delete, or list files, use the available file tools. Relative paths are resolved from the workspace root.`;
}

// ─────────────────────────────────────────────────────────────────────────────

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
    this._sidebarView = null;
    this._settingsPanel = null;
    this._history = []; // { role: 'user'|'assistant', content: string }[]
  }

  /**
   * @param {vscode.WebviewView} webviewView
   */
  resolveWebviewView(webviewView) {
    this._sidebarView = webviewView;

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

        if (message?.type === 'newChat') {
          this._history = [];
          return;
        }

        if (message?.type === 'fetchModels') {
          const settings = normalizeSettings(message.settings);
          if (settings.provider !== 'ollama-local' && !settings.apiKey) {
            webviewView.webview.postMessage({
              type: 'errorMessage',
              text: 'Please enter an API key first.'
            });
            return;
          }

          const models = await fetchModels(settings);
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
          const activeModel = settings.provider === 'ollama-local'
            ? (settings.localModel || settings.model)
            : settings.model;

          if (!text) return;

          if (settings.provider !== 'ollama-local' && !settings.apiKey) {
            webviewView.webview.postMessage({
              type: 'errorMessage',
              text: 'Set API key in settings.'
            });
            return;
          }

          if (!activeModel) {
            webviewView.webview.postMessage({
              type: 'errorMessage',
              text: 'Set model in settings.'
            });
            return;
          }

          const settingsToUse = { ...settings, model: activeModel };
          await this.context.globalState.update('aryx.settings', settingsToUse);
          webviewView.webview.postMessage({ type: 'replyStart' });

          const historyWithUser = [...this._history, { role: 'user', content: text }];
          let reply = '';
          if (settingsToUse.provider === 'ollama-local') {
            reply = await generateOllamaReply(settingsToUse, historyWithUser, (chunk) => {
              webviewView.webview.postMessage({ type: 'assistantMessageChunk', text: chunk });
            });
          } else {
            reply = await generateReply(settingsToUse, historyWithUser);
            webviewView.webview.postMessage({ type: 'assistantMessage', text: reply });
          }

          this._history = [...historyWithUser, { role: 'assistant', content: reply }];

          webviewView.webview.postMessage({ type: 'replyEnd' });
          return;
        }
      } catch (error) {
        webviewView.webview.postMessage({ type: 'replyEnd' });
        webviewView.webview.postMessage({ type: 'errorMessage', text: toUserError(error) });
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
      this._settingsPanel.webview.postMessage({
        type: 'settingsLoaded',
        settings: this._getSettings()
      });
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
      content="default-src 'none'; connect-src https://generativelanguage.googleapis.com https://openrouter.ai https://api.openai.com; img-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <link rel="stylesheet" href="${settingsCssUri}?v=${nonce}" />
    <title>Aryx Settings</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${appScriptUri}"></script>
  </body>
</html>`;

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
          webview.postMessage({ type: 'settingsSaved' });
          this._sidebarView?.webview.postMessage({ type: 'settingsLoaded', settings: nextSettings });
          return;
        }

        if (message?.type === 'fetchModels') {
          const settings = normalizeSettings(message.settings);
          if (settings.provider !== 'ollama-local' && !settings.apiKey) {
            webview.postMessage({
              type: 'errorMessage',
              text: 'Please enter an API key first.'
            });
            return;
          }

          const models = await fetchModels(settings);
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
      () => { this._settingsPanel = undefined; },
      null,
      this.context.subscriptions
    );
  }
}

// ─── Settings normalization ───────────────────────────────────────────────────

function normalizeSettings(value) {
  const validProviders = ['google-gemini', 'openrouter', 'openai', 'ollama-local'];
  const provider = validProviders.includes(value?.provider) ? value.provider : 'google-gemini';
  return {
    provider,
    apiKey: typeof value?.apiKey === 'string' ? value.apiKey.trim() : '',
    model: typeof value?.model === 'string' ? value.model.trim() : '',
    localBaseUrl: typeof value?.localBaseUrl === 'string' && value.localBaseUrl.trim()
      ? value.localBaseUrl.trim()
      : OLLAMA_DEFAULT_BASE,
    localModel: typeof value?.localModel === 'string' ? value.localModel.trim() : ''
  };
}

// ─── Fetch models (provider-agnostic) ────────────────────────────────────────

async function fetchModels(settings) {
  if (settings.provider === 'ollama-local') return fetchOllamaModels(settings.localBaseUrl);
  if (settings.provider === 'openrouter') return fetchOpenRouterModels(settings.apiKey);
  if (settings.provider === 'openai') return fetchOpenAIModels(settings.apiKey);
  return fetchGeminiModels(settings.apiKey);
}

async function fetchOllamaModels(baseUrl = OLLAMA_DEFAULT_BASE) {
  const url = `${sanitizeBaseUrl(baseUrl)}/api/tags`;
  const response = await fetch(url);
  if (!response.ok) {
    const bodyText = await safeReadText(response);
    throw new Error(parseApiError(response.status, bodyText));
  }

  const data = await response.json();
  const items = Array.isArray(data?.models) ? data.models : [];
  const modelNames = items
    .map((item) => String(item?.name || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return [...new Set(modelNames)];
}

async function fetchGeminiModels(apiKey) {
  const url = `${GEMINI_API_BASE}/models?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const bodyText = await safeReadText(response);
    throw new Error(parseApiError(response.status, bodyText));
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
    throw new Error(parseApiError(response.status, bodyText));
  }

  const data = await response.json();
  const items = Array.isArray(data?.data) ? data.data : [];

  const modelIds = items
    .map((item) => String(item?.id || ''))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return [...new Set(modelIds)];
}

async function fetchOpenAIModels(apiKey) {
  const url = `${OPENAI_API_BASE}/models`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  if (!response.ok) {
    const bodyText = await safeReadText(response);
    throw new Error(parseApiError(response.status, bodyText));
  }
  const data = await response.json();
  const items = Array.isArray(data?.data) ? data.data : [];
  const modelIds = items
    .map((item) => String(item?.id || ''))
    .filter((id) => id.startsWith('gpt'))
    .sort((a, b) => a.localeCompare(b));
  return [...new Set(modelIds)];
}

// ─── Generate reply (provider-agnostic, with agentic tool loop) ───────────────

async function generateReply(settings, history) {
  if (settings.provider === 'ollama-local') return generateOllamaReply(settings, history);
  if (settings.provider === 'openrouter') return generateOpenRouterReply(settings, history);
  if (settings.provider === 'openai') return generateOpenAIReply(settings, history);
  return generateGeminiReply(settings, history);
}

async function generateOllamaReply(settings, history, onChunk) {
  const modelName = settings.localModel || settings.model;
  const baseUrl = sanitizeBaseUrl(settings.localBaseUrl || OLLAMA_DEFAULT_BASE);
  const recentHistory = history.slice(-6);
  const messages = recentHistory.map((m) => ({
    role: m.role,
    content: String(m.content || '').slice(0, 2200),
  }));

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      messages,
      stream: true,
      keep_alive: '30m',
      options: {
        temperature: 0.2,
        num_predict: 180
      }
    })
  });

  if (!response.ok) {
    const bodyText = await safeReadText(response);
    throw new Error(parseApiError(response.status, bodyText));
  }

  if (!response.body) {
    const data = await response.json();
    const fallbackReply = String(data?.message?.content || '').trim();
    if (!fallbackReply) throw new Error('Ollama returned empty response. Try another prompt/model.');
    return fallbackReply;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullReply = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineEnd = buffer.indexOf('\n');
    while (lineEnd !== -1) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);
      if (line) {
        try {
          const chunk = JSON.parse(line);
          const textPart = String(chunk?.message?.content || '');
          if (textPart) {
            fullReply += textPart;
            if (typeof onChunk === 'function') onChunk(textPart);
          }
        } catch {
          // Ignore malformed stream chunk.
        }
      }
      lineEnd = buffer.indexOf('\n');
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    try {
      const chunk = JSON.parse(trailing);
      const textPart = String(chunk?.message?.content || '');
      if (textPart) {
        fullReply += textPart;
        if (typeof onChunk === 'function') onChunk(textPart);
      }
    } catch {
      // Ignore malformed trailing chunk.
    }
  }

  const reply = fullReply.trim();
  if (!reply) throw new Error('Ollama returned empty response. Try another prompt/model.');
  return reply;
}

// ─── OpenRouter reply with tool loop ─────────────────────────────────────────

async function generateOpenRouterReply(settings, history) {
  const messages = [
    { role: 'system', content: getSystemPrompt() },
    ...history.map(m => ({ role: m.role, content: m.content })),
  ];

  for (let i = 0; i < 10; i++) {
    const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aryx.dev',
        'X-Title': 'Aryx VS Code Extension'
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        tools: FILE_TOOLS,
      })
    });

    if (!response.ok) {
      const bodyText = await safeReadText(response);
      throw new Error(parseApiError(response.status, bodyText));
    }

    const data = await response.json();
    const msg = data?.choices?.[0]?.message;
    if (!msg) throw new Error('OpenRouter returned empty response. Try another prompt/model.');

    messages.push(msg);

    if (!msg.tool_calls?.length) {
      const reply = typeof msg.content === 'string' ? msg.content.trim() : '';
      if (!reply) throw new Error('OpenRouter returned empty response. Try another prompt/model.');
      return reply;
    }

    for (const tc of msg.tool_calls) {
      const args = JSON.parse(tc.function.arguments || '{}');
      const output = executeTool(tc.function.name, args);
      messages.push({ role: 'tool', tool_call_id: tc.id, content: output });
    }
  }

  return 'Max tool iterations reached.';
}

// ─── OpenAI reply with tool loop ─────────────────────────────────────────────

async function generateOpenAIReply(settings, history) {
  const messages = [
    { role: 'system', content: getSystemPrompt() },
    ...history.map(m => ({ role: m.role, content: m.content })),
  ];

  for (let i = 0; i < 10; i++) {
    const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        tools: FILE_TOOLS,
      })
    });

    if (!response.ok) {
      const bodyText = await safeReadText(response);
      throw new Error(parseApiError(response.status, bodyText));
    }

    const data = await response.json();
    const msg = data?.choices?.[0]?.message;
    if (!msg) throw new Error('OpenAI returned empty response. Try another prompt/model.');

    messages.push(msg);

    if (!msg.tool_calls?.length) {
      const reply = typeof msg.content === 'string' ? msg.content.trim() : '';
      if (!reply) throw new Error('OpenAI returned empty response. Try another prompt/model.');
      return reply;
    }

    for (const tc of msg.tool_calls) {
      const args = JSON.parse(tc.function.arguments || '{}');
      const output = executeTool(tc.function.name, args);
      messages.push({ role: 'tool', tool_call_id: tc.id, content: output });
    }
  }

  return 'Max tool iterations reached.';
}

// ─── Google Gemini reply with tool loop ──────────────────────────────────────

async function generateGeminiReply(settings, history) {
  const modelId = settings.model.replace(/^models\//, '');
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;

  const contents = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  for (let i = 0; i < 10; i++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        tools: [{ functionDeclarations: GEMINI_FUNCTION_DECLARATIONS }],
        systemInstruction: { parts: [{ text: getSystemPrompt() }] },
      })
    });

    if (!response.ok) {
      const bodyText = await safeReadText(response);
      throw new Error(parseApiError(response.status, bodyText));
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;

    if (!Array.isArray(parts) || !parts.length) {
      throw new Error('Gemini returned empty response. Try another prompt/model.');
    }

    const funcCalls = parts.filter(p => p.functionCall);

    if (!funcCalls.length) {
      const reply = parts.map(p => p.text || '').join('').trim();
      if (!reply) throw new Error('Gemini returned empty response. Try another prompt/model.');
      return reply;
    }

    // Add model's tool-call turn
    contents.push({ role: 'model', parts });

    // Execute each tool and collect responses
    const functionResponses = funcCalls.map(p => ({
      functionResponse: {
        name: p.functionCall.name,
        response: { content: executeTool(p.functionCall.name, p.functionCall.args || {}) },
      }
    }));

    contents.push({ role: 'function', parts: functionResponses });
  }

  return 'Max tool iterations reached.';
}

// ─── Utilities ────────────────────────────────────────────────────────────────

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return 'Unable to read error body';
  }
}

function parseApiError(status, bodyText) {
  try {
    const data = JSON.parse(bodyText);
    const msg =
      data?.error?.message ||
      data?.message ||
      (typeof data?.error === 'string' ? data.error : null) ||
      bodyText;
    return `${status}\n${String(msg).trim()}`;
  } catch {
    const trimmed = (bodyText || '').trim();
    return trimmed ? `${status}\n${trimmed}` : `${status}\nRequest failed`;
  }
}

function toUserError(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unknown error';
}

function sanitizeBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '') || OLLAMA_DEFAULT_BASE;
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
