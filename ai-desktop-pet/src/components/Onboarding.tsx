import { useState } from 'react';
import { DEFAULT_SETTINGS } from '../lib/config';
import type { Settings } from '../lib/types';

interface OnboardingProps {
  onComplete: (settings: Settings) => void;
}

type Step = 'name' | 'api' | 'intro';

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>('name');
  const [petName, setPetName] = useState(DEFAULT_SETTINGS.pet.name);
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState(DEFAULT_SETTINGS.llm.baseURL);
  const [model, setModel] = useState(DEFAULT_SETTINGS.llm.model);
  const [userName, setUserName] = useState('');
  const [userNote, setUserNote] = useState('');

  const handleFinish = () => {
    const settings: Settings = {
      llm: { apiKey, baseURL, model },
      pet: { name: petName || DEFAULT_SETTINGS.pet.name },
      user: { name: userName, note: userNote },
    };
    onComplete(settings);
  };

  return (
    <div className="onboarding-overlay" onMouseDown={(e) => e.stopPropagation()}>
      <div className="onboarding-card">
        {step === 'name' && (
          <>
            <div className="onboarding-title">给宠物起个名字</div>
            <div className="onboarding-desc">它会陪你工作，得有个名字。</div>
            <input
              className="onboarding-input"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              placeholder="默认：利落"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && setStep('api')}
            />
            <button className="onboarding-btn" onClick={() => setStep('api')}>
              下一步
            </button>
          </>
        )}

        {step === 'api' && (
          <>
            <div className="onboarding-title">配置 AI</div>
            <div className="onboarding-desc">需要一个 OpenAI 兼容的 API Key。</div>
            <input
              className="onboarding-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              autoFocus
            />
            <input
              className="onboarding-input onboarding-input-sm"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="API Base URL"
            />
            <input
              className="onboarding-input onboarding-input-sm"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Model"
            />
            <div className="onboarding-row">
              <button className="onboarding-btn onboarding-btn-back" onClick={() => setStep('name')}>
                返回
              </button>
              <button
                className="onboarding-btn"
                disabled={!apiKey.trim()}
                onClick={() => setStep('intro')}
              >
                下一步
              </button>
            </div>
          </>
        )}

        {step === 'intro' && (
          <>
            <div className="onboarding-title">让它认识你</div>
            <div className="onboarding-desc">简单介绍自己，它会记住。</div>
            <input
              className="onboarding-input"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="你的名字"
              autoFocus
            />
            <textarea
              className="onboarding-textarea"
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="例如：产品经理，关注 AI 方向"
              rows={3}
            />
            <div className="onboarding-row">
              <button className="onboarding-btn onboarding-btn-back" onClick={() => setStep('api')}>
                返回
              </button>
              <button className="onboarding-btn" onClick={handleFinish}>
                开始
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
