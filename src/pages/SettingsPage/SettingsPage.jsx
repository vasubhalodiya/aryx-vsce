import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Settings, Sliders, Palette, Server, Puzzle, Cpu } from 'lucide-react';
import General from './sections/General/General';
import AI from './sections/AI/AI';
import '../../styles/variables.css';
import './SettingsPage.css';

const vscode = acquireVsCodeApi();

function SettingsApp() {
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general', icon: <Settings size={16} />, label: 'General' },
    { id: 'ai', icon: <Cpu size={16} />, label: 'AI' },
    // { id: 'config', icon: <Sliders size={16} />, label: 'Configuration' },
    // { id: 'personal', icon: <Palette size={16} />, label: 'Personalization' },
    // { id: 'mcp', icon: <Server size={16} />, label: 'MCP servers' },
    // { id: 'plugins', icon: <Puzzle size={16} />, label: 'Plugins' }
  ];

  return (
    <div className="settings-container">
      <div className="settings-sidebar">
        {tabs.map(tab => (
          <div 
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </div>
        ))}
      </div>
      
      <div className="settings-content">
        {activeTab === 'general' && <General />}
        {activeTab === 'ai' && <AI vscode={vscode} />}
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<SettingsApp />);
}
