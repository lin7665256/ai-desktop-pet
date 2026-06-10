import { useEffect } from 'react';
import type { BubbleData } from '../lib/types';
import { BUBBLE_DISPLAY_MS } from '../lib/config';

interface BubbleProps {
  data: BubbleData;
  onDismiss: () => void;
  autoDismiss?: boolean;
}

export default function Bubble({ data, onDismiss, autoDismiss = true }: BubbleProps) {
  useEffect(() => {
    if (autoDismiss && data.type !== 'progress') {
      const timer = setTimeout(onDismiss, BUBBLE_DISPLAY_MS);
      return () => clearTimeout(timer);
    }
  }, [data, onDismiss, autoDismiss]);

  const cssClass = `bubble bubble-${data.type}`;

  return (
    <div className={cssClass} onClick={data.type !== 'progress' ? onDismiss : undefined}>
      <div className="bubble-text">{data.text}</div>

      {data.relatedFile && (
        <div className="bubble-association">关联: {data.relatedFile}</div>
      )}

      {data.topics && data.topics.length > 0 && (
        <div className="bubble-topics">
          {data.topics.map((t, i) => (
            <span key={i} className="topic-pill">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
