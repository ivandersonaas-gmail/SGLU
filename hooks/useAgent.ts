
import { useState, useRef, useCallback } from 'react';
import { AgentMode, Message, Role, AttachmentData, ToolHandlers } from '../types';
import { streamChatResponse } from '../services/gemini';
import { ProcessService } from '../services/supabase';

interface UseAgentProps {
  mode: AgentMode;
  initialMessages?: Message[];
  processId: string | null;
  toolHandlers: ToolHandlers;
}

export const useAgent = ({ mode, initialMessages = [], processId, toolHandlers }: UseAgentProps) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const processMessage = useCallback(async (text: string, attachments: AttachmentData[], history: Message[], highPrecision: boolean = false, specialty?: string) => {
    setIsStreaming(true);
    
    const botMessageId = (Date.now() + 1).toString();
    const botMessageSkeleton: Message = {
      id: botMessageId,
      role: Role.MODEL,
      text: '',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, botMessageSkeleton]);

    try {
      let fullText = '';
      await streamChatResponse(
        history,
        text,
        attachments,
        mode,
        true,
        toolHandlers,
        (chunk) => {
          fullText += chunk;
          setMessages(prev => 
            prev.map(m => m.id === botMessageId ? { ...m, text: fullText } : m)
          );
        },
        (sources) => {
            setMessages(prev => 
                prev.map(m => m.id === botMessageId ? { ...m, sources: sources } : m)
            );
        },
        highPrecision,
        specialty
      );
    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(m => m.id === botMessageId ? { ...m, text: "Ocorreu um erro no processamento. Verifique sua conexão." } : m));
    } finally {
      setIsStreaming(false);
      setLoadingStatus(null);
    }
  }, [mode, toolHandlers]);

  return {
    messages,
    setMessages,
    isStreaming,
    loadingStatus,
    setLoadingStatus,
    processMessage,
    addMessage
  };
};
