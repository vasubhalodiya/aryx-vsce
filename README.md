# Aryx VS Code Extension (React + Gemini)

Clean, compact chat UI inspired by Codex-style sidebar.

## Features
- Minimal dark UI (no gradient)
- Settings icon (`⚙`) at top
- Provider dropdown (currently: Google Gemini)
- API key input
- Model dropdown from official Gemini API model list
- Chat response from selected Gemini model

## Run locally
1. Open folder in VS Code.
2. Install dependencies: `npm install`
3. Build webview bundle: `npm run build`
4. Run and Debug -> select `Run Aryx Extension`
5. Press `F5`
6. In Extension Development Host, open `Aryx` view

## Use flow
1. Click settings icon
2. Enter Gemini API key
3. Click `Load Models`
4. Select model
5. Type message and press Enter

## Files
- React source: `src/main.jsx`
- Bundled script: `media/main.js`
- Styles: `media/styles.css`
- Extension backend + Gemini API calls: `extension.js`
