import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, Settings, CoreMemory } from '../lib/types';
import { chatCompletion } from '../services/llm';
import { buildChatPrompt } from '../prompts/system';

export function useChat(settings: Settings | null, coreMemory: CoreMemory | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const openChat = useCallback(() => {
    setIsVisible(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsVisible(false);
    setMessages([]);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!settings?.llm.apiKey || !coreMemory || !text.trim()) return;

      const userMessage: ChatMessage = {
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsProcessing(true);

      try {
        const systemPrompt = buildChatPrompt(coreMemory, settings.pet.name);
        const allMessages = [...messagesRef.current, userMessage];
        const response = await chatCompletion(settings.llm, systemPrompt, allMessages);

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: '出了点问题。再试一次。',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsProcessing(false);
      }
    },
    [settings, coreMemory],
  );

  return {
    messages,
    isVisible,
    isProcessing,
    openChat,
    closeChat,
    sendMessage,
  };
}
