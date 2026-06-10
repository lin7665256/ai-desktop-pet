import { useState } from 'react';
import type { Settings } from '../lib/types';

interface SettingsPanelProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

export default function SettingsPanel({ settings, onSave, onClose }: SettingsPanelProps) {
  const [draft, setDraft] = useState<Settings>({ ...settings });

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={onClose} onMouseDown={(e) => e.stopPropagation()}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">设置</span>
          <button className="settings-close" onClick={onClose}>x</button>
        </div>

        <div className="settings-section">
          <label className="settings-label">API Key</label>
          <input
            className="settings-input"
            type="password"
            value={draft.llm.apiKey}
            onChange={(e) => setDraft({ ...draft, llm: { ...draft.llm, apiKey: e.target.value } })}
            placeholder="sk-..."
          />
        </div>

        <div className="settings-section">
          <label className="settings-label">API Base URL</label>
          <input
            className="settings-input"
            type="text"
            value={draft.llm.baseURL}
            onChange={(e) => setDraft({ ...draft, llm: { ...draft.llm, baseURL: e.target.value } })}
            placeholder="https://api.openai.com/v1"
          />
        </div>

        <div className="settings-section">
          <label className="settings-label">Model</label>
          <input
            className="settings-input"
            type="text"
            value={draft.llm.model}
            onChange={(e) => setDraft({ ...draft, llm: { ...draft.llm, model: e.target.value } })}
            placeholder="gpt-4o-mini"
          />
        </div>

        <div className="settings-section">
          <label className="settings-label">宠物名字</label>
          <input
            className="settings-input"
            type="text"
            value={draft.pet.name}
            onChange={(e) => setDraft({ ...draft, pet: { ...draft.pet, name: e.target.value } })}
          />
        </div>

        <div className="settings-section">
          <label className="settings-label">你的名字</label>
          <input
            className="settings-input"
            type="text"
            value={draft.user.name}
            onChange={(e) => setDraft({ ...draft, user: { ...draft.user, name: e.target.value } })}
          />
        </div>

        <div className="settings-section">
          <label className="settings-label">简介 (让宠物了解你)</label>
          <textarea
            className="settings-textarea"
            value={draft.user.note}
            onChange={(e) => setDraft({ ...draft, user: { ...draft.user, note: e.target.value } })}
            placeholder="例如：产品经理，关注 AI 方向"
            rows={3}
          />
        </div>

        <div className="settings-footer">
          <button className="settings-btn settings-btn-cancel" onClick={onClose}>取消</button>
          <button className="settings-btn settings-btn-save" onClick={handleSave}>保存</button>
        </div>

        <div className="settings-privacy">
          数据仅存本地。API Key 不上传任何服务器。
        </div>
      </div>
    </div>
  );
}
