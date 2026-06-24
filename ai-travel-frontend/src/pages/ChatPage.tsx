import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  WifiOff,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import { useTripStore } from '@/store/useTripStore';
import { generateId } from '@/utils/helpers';
import type { ChatMessage } from '@/types';
import {
  streamChatMessage,
  checkBackendHealth,
  resetSession,
  getSessionId,
  type StreamEvent,
} from '@/api/services';
import toast from 'react-hot-toast';

// ── Backend status banner ─────────────────────────────────────────────────────

type BackendStatus = 'checking' | 'online' | 'offline';

function StatusBadge({ status, model }: { status: BackendStatus; model?: string }) {
  if (status === 'checking') {
    return (
      <span className="flex items-center gap-1 text-xs text-yellow-500 dark:text-yellow-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        Connecting…
      </span>
    );
  }
  if (status === 'offline') {
    return (
      <span className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
        <WifiOff className="w-3 h-3" />
        Backend offline
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-green-500 dark:text-green-400">
      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      {model ? `Connected · ${model}` : 'Connected'}
    </span>
  );
}

// ── Simple markdown bold renderer ─────────────────────────────────────────────

function MarkdownLine({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="text-sm whitespace-pre-wrap leading-relaxed">
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          <MarkdownLine text={line} />
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Tool call indicator ───────────────────────────────────────────────────────

function ToolCallBadge({ tool }: { tool: string }) {
  const label = tool
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 mr-1 mb-1">
      <Wrench className="w-3 h-3" />
      {label}
    </span>
  );
}

// ── Main ChatPage ─────────────────────────────────────────────────────────────

export function ChatPage() {
  const { chatMessages, addMessage, clearMessages } = useTripStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [backendModel, setBackendModel] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  // Health check on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const health = await checkBackendHealth();
      if (cancelled) return;
      if (health.ok) {
        setBackendStatus('online');
        setBackendModel(health.model);
      } else {
        setBackendStatus('offline');
        toast.error(health.error || 'Backend is offline', { duration: 5000 });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isTyping) return;

    if (backendStatus === 'offline') {
      toast.error('The AI backend is offline. Please start api_server.py first.');
      return;
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    const userText = input.trim();
    setInput('');
    setIsTyping(true);
    setStatusText('Thinking…');
    setActiveTools([]);

    // Placeholder message id for the streaming response
    const assistantMsgId = generateId();
    let assistantContent = '';

    // Add an empty assistant message that we'll update as chunks arrive
    addMessage({
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    });

    const sessionId = getSessionId();

    const cleanup = streamChatMessage(
      userText,
      sessionId,
      // onEvent
      (event: StreamEvent) => {
        switch (event.type) {
          case 'status':
            setStatusText((event.payload.message as string) || '');
            break;

          case 'tool_start': {
            const tool = event.payload.tool as string;
            setActiveTools((prev) => [...prev, tool]);
            setStatusText(`Using tool: ${tool.replace(/_/g, ' ')}…`);
            break;
          }

          case 'tool_result':
            // Tool finished; keep status until reply arrives
            break;

          case 'reply': {
            const content = event.payload.content as string;
            assistantContent = content;

            // Replace the placeholder message with the real content
            // We can't mutate Zustand messages directly, so we use addMessage
            // and store will deduplicate by id — instead we clear+re-add.
            // Simpler: use a custom Zustand action. For now, update via useTripStore.
            useTripStore.setState((state) => ({
              chatMessages: state.chatMessages.map((m) =>
                m.id === assistantMsgId ? { ...m, content } : m
              ),
            }));

            setStatusText('');
            setActiveTools([]);
            break;
          }

          case 'error': {
            const errMsg = (event.payload.message as string) || 'Unknown error';
            useTripStore.setState((state) => ({
              chatMessages: state.chatMessages.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: `⚠️ Error: ${errMsg}` }
                  : m
              ),
            }));
            toast.error(errMsg);
            setStatusText('');
            setActiveTools([]);
            setIsTyping(false);
            break;
          }

          case 'done':
            setIsTyping(false);
            setStatusText('');
            setActiveTools([]);
            break;
        }
      },
      // onError
      (err: string) => {
        useTripStore.setState((state) => ({
          chatMessages: state.chatMessages.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: `⚠️ Connection error: ${err}` }
              : m
          ),
        }));
        toast.error(err);
        setIsTyping(false);
        setStatusText('');
        setActiveTools([]);
      },
      // onDone
      () => {
        setIsTyping(false);
        setStatusText('');
        setActiveTools([]);
      }
    );

    cleanupRef.current = cleanup;
  }, [input, isTyping, backendStatus, addMessage]);

  const handleReset = async () => {
    if (isTyping) {
      cleanupRef.current?.();
      setIsTyping(false);
    }
    try {
      await resetSession();
      clearMessages();
      toast.success('Conversation reset.');
    } catch {
      clearMessages();
    }
  };

  const suggestions = [
    'Plan a trip to Paris',
    'Find flights from Delhi to London',
    'What hotels are in Tokyo?',
    'Help me plan my budget',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-travel-sky flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI Travel Assistant
            </h1>
            <StatusBadge status={backendStatus} model={backendModel} />
          </div>
        </div>

        <button
          onClick={handleReset}
          title="Reset conversation"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reset
        </button>
      </div>

      {/* Active tool badges */}
      {activeTools.length > 0 && (
        <div className="pt-3 px-1 flex flex-wrap">
          {activeTools.map((t, i) => (
            <ToolCallBadge key={`${t}-${i}`} tool={t} />
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-brand-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Start Planning Your Trip
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
              Tell me about your dream destination and I'll help you plan flights,
              hotels, activities, and budget — powered by real AI.
            </p>
            {backendStatus === 'offline' && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400 max-w-md">
                ⚠️ Backend is offline. Run <code className="font-mono font-bold">python api_server.py</code> in the project root to start it.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 max-w-md w-full">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    inputRef.current?.focus();
                  }}
                  className="text-left text-sm p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-brand-50 dark:hover:bg-brand-900/10 hover:border-brand-300 dark:hover:border-brand-700 transition-colors text-gray-700 dark:text-gray-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              </div>
            )}
            <div
              className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              }`}
            >
              {msg.content ? (
                <MessageContent content={msg.content} />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}

        {/* Typing / status indicator (only when a message is in-flight but not yet started) */}
        {isTyping && statusText && chatMessages[chatMessages.length - 1]?.content === '' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
              <Bot className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">{statusText}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="input-field flex-1"
            placeholder={
              backendStatus === 'offline'
                ? 'Backend offline — start api_server.py first'
                : 'Tell me about your trip…'
            }
            disabled={isTyping || backendStatus === 'offline'}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping || backendStatus === 'offline'}
            className="btn-primary px-4"
          >
            {isTyping ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        {isTyping && statusText && (
          <p className="text-xs text-brand-500 dark:text-brand-400 mt-2 text-center animate-pulse">
            {statusText}
          </p>
        )}
      </div>
    </div>
  );
}
