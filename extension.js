const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');

// ─── Constants ────────────────────────────────────────────────────────────────

const VIEW_ID = 'aryxChatView';
const COMMAND_FOCUS = 'aryxChat.focus';
const MAX_TOOL_ITERATIONS = 10;

const API = {
  GEMINI_BASE:     'https://generativelanguage.googleapis.com/v1beta',
  OPENROUTER_BASE: 'https://openrouter.ai/api/v1',
  OPENAI_BASE:     'https://api.openai.com/v1',
  OLLAMA_BASE:     'http://127.0.0.1:11434',
};

const VALID_PROVIDERS = ['google-gemini', 'openrouter', 'openai', 'ollama-local'];

// ─── File System Tools ────────────────────────────────────────────────────────

function getWorkspacePath() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
}

function resolvePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(getWorkspacePath(), filePath);
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
  read_file:   (a) => fs.readFileSync(resolvePath(a.file_path), 'utf8'),
  write_file:  (a) => {
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
  file_exists: (a) => fs.existsSync(resolvePath(a.file_path))
    ? `Exists: ${a.file_path}`
    : `Not found: ${a.file_path}`,
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

// ─── Tool Definitions ─────────────────────────────────────────────────────────

function toolDef(name, description, properties, required = []) {
  return { type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } };
}

const FILE_TOOLS = [
  toolDef('create_file',  'Create a new file with content (fails if already exists)',
    { file_path: { type: 'string' }, content: { type: 'string' } }, ['file_path', 'content']),
  toolDef('read_file',    'Read and return the full contents of a file',
    { file_path: { type: 'string' } }, ['file_path']),
  toolDef('write_file',   'Overwrite a file with new content (creates if missing)',
    { file_path: { type: 'string' }, content: { type: 'string' } }, ['file_path', 'content']),
  toolDef('append_file',  'Append content to the end of a file',
    { file_path: { type: 'string' }, content: { type: 'string' } }, ['file_path', 'content']),
  toolDef('edit_file',    'Find old_text in a file and replace it with new_text',
    { file_path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } }, ['file_path', 'old_text', 'new_text']),
  toolDef('delete_file',  'Delete a single file',
    { file_path: { type: 'string' } }, ['file_path']),
  toolDef('copy_file',    'Copy a file from src path to dest path',
    { src: { type: 'string' }, dest: { type: 'string' } }, ['src', 'dest']),
  toolDef('move_file',    'Move or rename a file from src to dest',
    { src: { type: 'string' }, dest: { type: 'string' } }, ['src', 'dest']),
  toolDef('list_files',   'List files and folders in a directory',
    { dir_path: { type: 'string' } }),
  toolDef('make_dir',     'Create a directory and any missing parent directories',
    { dir_path: { type: 'string' } }, ['dir_path']),
  toolDef('delete_dir',   'Recursively delete a directory and all its contents',
    { dir_path: { type: 'string' } }, ['dir_path']),
  toolDef('file_exists',  'Check whether a file or directory exists',
    { file_path: { type: 'string' } }, ['file_path']),
];

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
  return `You are a helpful AI coding assistant with file system access.\nWorkspace: ${getWorkspacePath()}\n\nUse the available file tools when the user asks to read, create, edit, write, delete, or list files. Relative paths resolve from the workspace root.`;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function normalizeSettings(value) {
  const provider = VALID_PROVIDERS.includes(value?.provider) ? value.provider : 'google-gemini';
  return {
    provider,
    apiKey:       typeof value?.apiKey      === 'string' ? value.apiKey.trim()       : '',
    model:        typeof value?.model       === 'string' ? value.model.trim()        : '',
    localBaseUrl: typeof value?.localBaseUrl === 'string' && value.localBaseUrl.trim()
      ? value.localBaseUrl.trim()
      : API.OLLAMA_BASE,
    localModel:   typeof value?.localModel  === 'string' ? value.localModel.trim()  : '',
  };
}

// ─── Model Fetching ───────────────────────────────────────────────────────────

async function fetchModels(settings) {
  switch (settings.provider) {
    case 'ollama-local': return _fetchOllamaModels(settings.localBaseUrl);
    case 'openrouter':   return _fetchOpenRouterModels(settings.apiKey);
    case 'openai':       return _fetchOpenAIModels(settings.apiKey);
    default:             return _fetchGeminiModels(settings.apiKey);
  }
}

async function _fetchOllamaModels(baseUrl = API.OLLAMA_BASE) {
  const data = await apiFetch(`${sanitizeBaseUrl(baseUrl)}/api/tags`).then(r => r.json());
  return dedupeSorted(
    (data?.models ?? []).map(item => String(item?.name || '').trim()).filter(Boolean)
  );
}

async function _fetchGeminiModels(apiKey) {
  const data = await apiFetch(
    `${API.GEMINI_BASE}/models?key=${encodeURIComponent(apiKey)}`
  ).then(r => r.json());
  return dedupeSorted(
    (data?.models ?? [])
      .filter(item => {
        const name    = String(item?.name || '');
        const methods = Array.isArray(item?.supportedGenerationMethods) ? item.supportedGenerationMethods : [];
        return name.includes('gemini') && methods.includes('generateContent');
      })
      .map(item => String(item.name || '').replace(/^models\//, ''))
      .filter(Boolean)
  );
}

async function _fetchOpenRouterModels(apiKey) {
  const data = await apiFetch(`${API.OPENROUTER_BASE}/models`, {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  }).then(r => r.json());
  return dedupeSorted(
    (data?.data ?? []).map(item => String(item?.id || '')).filter(Boolean)
  );
}

async function _fetchOpenAIModels(apiKey) {
  const data = await apiFetch(`${API.OPENAI_BASE}/models`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  }).then(r => r.json());
  return dedupeSorted(
    (data?.data ?? []).map(item => String(item?.id || '')).filter(id => id.startsWith('gpt'))
  );
}

// ─── Reply Generation ─────────────────────────────────────────────────────────

async function generateReply(settings, history, onChunk) {
  switch (settings.provider) {
    case 'ollama-local': return _generateOllamaReply(settings, history, onChunk);
    case 'openrouter':   return _generateOpenAICompatibleReply(
      `${API.OPENROUTER_BASE}/chat/completions`,
      { 'Authorization': `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://aryx.dev', 'X-Title': 'Aryx VS Code Extension' },
      settings, history, 'OpenRouter'
    );
    case 'openai':       return _generateOpenAICompatibleReply(
      `${API.OPENAI_BASE}/chat/completions`,
      { 'Authorization': `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
      settings, history, 'OpenAI'
    );
    default:             return _generateGeminiReply(settings, history);
  }
}

async function _generateOllamaReply(settings, history, onChunk) {
  const modelName = settings.localModel || settings.model;
  const baseUrl   = sanitizeBaseUrl(settings.localBaseUrl || API.OLLAMA_BASE);

  const messages = [
    { role: 'system', content: getSystemPrompt() },
    ...history.slice(-6).map(m => ({
      role: m.role,
      content: String(m.content || '').slice(0, 2200),
    })),
  ];

  const response = await apiFetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      messages,
      stream: true,
      keep_alive: '30m',
      options: { temperature: 0.2, num_predict: 180 },
    }),
  });

  if (!response.body) {
    const data  = await response.json();
    const reply = String(data?.message?.content || '').trim();
    if (!reply) throw new Error('Ollama returned empty response. Try another prompt/model.');
    return reply;
  }

  return _streamOllamaBody(response.body, onChunk);
}

async function _streamOllamaBody(body, onChunk) {
  const reader  = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer    = '';
  let fullReply = '';

  const processLine = (line) => {
    if (!line) return;
    try {
      const chunk = JSON.parse(line);
      const text  = String(chunk?.message?.content || '');
      if (text) { fullReply += text; onChunk?.(text); }
    } catch { /* ignore malformed chunk */ }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      processLine(buffer.slice(0, nl).trim());
      buffer = buffer.slice(nl + 1);
    }
  }
  processLine(buffer.trim());

  const reply = fullReply.trim();
  if (!reply) throw new Error('Ollama returned empty response. Try another prompt/model.');
  return reply;
}

async function _generateOpenAICompatibleReply(url, headers, settings, history, providerName) {
  const messages = [
    { role: 'system', content: getSystemPrompt() },
    ...history.map(m => ({ role: m.role, content: m.content })),
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const data = await apiFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: settings.model, messages, tools: FILE_TOOLS }),
    }).then(r => r.json());

    const msg = data?.choices?.[0]?.message;
    if (!msg) throw new Error(`${providerName} returned empty response. Try another prompt/model.`);
    messages.push(msg);

    if (!msg.tool_calls?.length) {
      const reply = typeof msg.content === 'string' ? msg.content.trim() : '';
      if (!reply) throw new Error(`${providerName} returned empty response. Try another prompt/model.`);
      return reply;
    }

    for (const tc of msg.tool_calls) {
      const args = JSON.parse(tc.function.arguments || '{}');
      messages.push({ role: 'tool', tool_call_id: tc.id, content: executeTool(tc.function.name, args) });
    }
  }

  return 'Max tool iterations reached.';
}

async function _generateGeminiReply(settings, history) {
  const modelId = settings.model.replace(/^models\//, '');
  const url = `${API.GEMINI_BASE}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;

  const contents = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const data = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        tools: [{ functionDeclarations: GEMINI_FUNCTION_DECLARATIONS }],
        systemInstruction: { parts: [{ text: getSystemPrompt() }] },
      }),
    }).then(r => r.json());

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

    contents.push({ role: 'model', parts });
    contents.push({
      role: 'function',
      parts: funcCalls.map(p => ({
        functionResponse: {
          name: p.functionCall.name,
          response: { content: executeTool(p.functionCall.name, p.functionCall.args || {}) },
        },
      })),
    });
  }

  return 'Max tool iterations reached.';
}

// ─── Extension Entry Point ────────────────────────────────────────────────────

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const provider = new AryxChatViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider),
    vscode.commands.registerCommand(COMMAND_FOCUS, () =>
      vscode.commands.executeCommand(`${VIEW_ID}.focus`)
    )
  );
}

// ─── Webview Provider ─────────────────────────────────────────────────────────

class AryxChatViewProvider {
  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this._context       = context;
    this._extensionUri  = context.extensionUri;
    this._sidebarView   = null;
    this._settingsPanel = null;
    this._history       = [];
  }

  /**
   * @param {vscode.WebviewView} webviewView
   */
  resolveWebviewView(webviewView) {
    this._sidebarView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._buildHtml(webviewView.webview, 'main.js', 'main.css');

    webviewView.webview.onDidReceiveMessage(async (message) => {
      const { webview } = webviewView;
      try {
        switch (message?.type) {
          case 'openSettings':
            this._openSettingsPanel();
            return;

          case 'getSettings':
            webview.postMessage({ type: 'settingsLoaded', settings: this._loadSettings() });
            return;

          case 'saveSettings': {
            const settings = normalizeSettings(message.settings);
            await this._persistSettings(settings);
            webview.postMessage({ type: 'settingsLoaded', settings });
            return;
          }

          case 'newChat':
            this._history = [];
            return;

          case 'fetchModels': {
            const settings = normalizeSettings(message.settings);
            if (settings.provider !== 'ollama-local' && !settings.apiKey) {
              webview.postMessage({ type: 'errorMessage', text: 'Please enter an API key first.' });
              return;
            }
            const models = await fetchModels(settings);
            webview.postMessage({ type: 'modelsLoaded', models });
            if (!settings.model && models.length > 0) {
              const updated = { ...settings, model: models[0] };
              await this._persistSettings(updated);
              webview.postMessage({ type: 'settingsLoaded', settings: updated });
            }
            return;
          }

          case 'sendMessage': {
            const text = String(message.text || '').trim();
            if (!text) return;

            const settings    = normalizeSettings(message.settings);
            const activeModel = settings.provider === 'ollama-local'
              ? (settings.localModel || settings.model)
              : settings.model;

            if (settings.provider !== 'ollama-local' && !settings.apiKey) {
              webview.postMessage({ type: 'errorMessage', text: 'Set API key in settings.' });
              return;
            }
            if (!activeModel) {
              webview.postMessage({ type: 'errorMessage', text: 'Set model in settings.' });
              return;
            }

            const resolved = { ...settings, model: activeModel };
            await this._persistSettings(resolved);
            webview.postMessage({ type: 'replyStart' });

            const historyWithUser = [...this._history, { role: 'user', content: text }];
            const reply = await generateReply(resolved, historyWithUser, (chunk) => {
              webview.postMessage({ type: 'assistantMessageChunk', text: chunk });
            });

            if (resolved.provider !== 'ollama-local') {
              webview.postMessage({ type: 'assistantMessage', text: reply });
            }

            this._history = [...historyWithUser, { role: 'assistant', content: reply }];
            webview.postMessage({ type: 'replyEnd' });
            return;
          }
        }
      } catch (error) {
        webview.postMessage({ type: 'replyEnd' });
        webview.postMessage({ type: 'errorMessage', text: toUserError(error) });
      }
    });
  }

  _loadSettings() {
    return normalizeSettings(this._context.globalState.get('aryx.settings'));
  }

  async _persistSettings(settings) {
    await this._context.globalState.update('aryx.settings', settings);
  }

  _buildHtml(webview, scriptFile, cssFile, extraCsp = '') {
    const nonce     = getNonce();
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', scriptFile));
    const cssUri    = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', cssFile));
    const title     = scriptFile.startsWith('settings') ? 'Aryx Settings' : 'Aryx';

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; ${extraCsp}img-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <link rel="stylesheet" href="${cssUri}?v=${nonce}" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }

  _openSettingsPanel() {
    if (this._settingsPanel) {
      this._settingsPanel.reveal(vscode.ViewColumn.One);
      this._settingsPanel.webview.postMessage({ type: 'settingsLoaded', settings: this._loadSettings() });
      return;
    }

    this._settingsPanel = vscode.window.createWebviewPanel(
      'aryxSettings', 'Aryx Settings', vscode.ViewColumn.One,
      { enableScripts: true, localResourceRoots: [this._extensionUri] }
    );
    this._settingsPanel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'aryx-logo.svg');

    const { webview } = this._settingsPanel;
    const cspConnect  = `connect-src ${API.GEMINI_BASE} ${API.OPENROUTER_BASE} ${API.OPENAI_BASE} ${API.OLLAMA_BASE}; `;
    webview.html = this._buildHtml(webview, 'settings.js', 'settings.css', cspConnect);

    webview.onDidReceiveMessage(async (message) => {
      try {
        switch (message?.type) {
          case 'getSettings':
            webview.postMessage({ type: 'settingsLoaded', settings: this._loadSettings() });
            return;

          case 'saveSettings': {
            const settings = normalizeSettings(message.settings);
            await this._persistSettings(settings);
            webview.postMessage({ type: 'settingsSaved' });
            this._sidebarView?.webview.postMessage({ type: 'settingsLoaded', settings });
            return;
          }

          case 'fetchModels': {
            const settings = normalizeSettings(message.settings);
            if (settings.provider !== 'ollama-local' && !settings.apiKey) {
              webview.postMessage({ type: 'errorMessage', text: 'Please enter an API key first.' });
              return;
            }
            const models = await fetchModels(settings);
            webview.postMessage({ type: 'modelsLoaded', models });
            return;
          }
        }
      } catch (error) {
        webview.postMessage({ type: 'errorMessage', text: toUserError(error) });
      }
    }, null, this._context.subscriptions);

    this._settingsPanel.onDidDispose(
      () => { this._settingsPanel = undefined; },
      null,
      this._context.subscriptions
    );
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await safeReadText(response);
    throw new Error(parseApiError(response.status, body));
  }
  return response;
}

async function safeReadText(response) {
  try { return await response.text(); } catch { return 'Unable to read error body'; }
}

function parseApiError(status, bodyText) {
  try {
    const data = JSON.parse(bodyText);
    const msg  = data?.error?.message
      || data?.message
      || (typeof data?.error === 'string' ? data.error : null)
      || bodyText;
    return `${status}\n${String(msg).trim()}`;
  } catch {
    const trimmed = (bodyText || '').trim();
    return trimmed ? `${status}\n${trimmed}` : `${status}\nRequest failed`;
  }
}

function toUserError(error) {
  return error instanceof Error && error.message ? error.message : 'Unknown error';
}

function sanitizeBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '') || API.OLLAMA_BASE;
}

function dedupeSorted(arr) {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
}

function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function deactivate() {}

module.exports = { activate, deactivate };
