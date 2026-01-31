'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Trash2, Sparkles, Loader2, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/utils/cn';
import { ChatMessage, DEFAULT_QUICK_ACTIONS } from '@/core/models';
import { chatMessageRepository } from '@/core/repositories/ChatMessageRepository';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { userSettingsRepository } from '@/core/repositories/UserSettingsRepository';
import { convertCurrency } from '@/shared/services/currencyService';

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}

export default function AIChatSidebar({ isOpen, onClose, userId }: AIChatSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history
  useEffect(() => {
    if (isOpen && userId) {
      loadHistory();
    }
  }, [isOpen, userId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const loadHistory = async () => {
    if (!userId) return;
    setLoadingHistory(true);
    try {
      const history = await chatMessageRepository.getRecentByUserId(userId);
      setMessages(history);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const getFinancialContext = async () => {
    if (!userId) return null;

    try {
      const [transactions, categories, accounts, settings] = await Promise.all([
        transactionRepository.getByUserId(userId),
        categoryRepository.getByUserId(userId),
        accountRepository.getByUserId(userId),
        userSettingsRepository.getOrCreate(userId),
      ]);

      // Calculate total balance with currency conversion
      let totalBalance = 0;
      for (const account of accounts) {
        if (account.currency === settings.baseCurrency) {
          totalBalance += account.balance;
        } else {
          const converted = await convertCurrency(
            account.balance,
            account.currency,
            settings.baseCurrency
          );
          totalBalance += converted;
        }
      }

      // Map categories for quick lookup
      const categoryMap = new Map(categories.map((c) => [c.id, c]));

      // Convert all transactions to base currency
      const transactionsWithConversion = await Promise.all(
        transactions.map(async (t) => {
          let amountInBaseCurrency = t.amount;
          if (t.currency !== settings.baseCurrency) {
            amountInBaseCurrency = await convertCurrency(
              t.amount,
              t.currency,
              settings.baseCurrency
            );
          }
          return {
            type: t.type,
            amount: amountInBaseCurrency,
            originalAmount: t.amount,
            originalCurrency: t.currency,
            categoryName: categoryMap.get(t.categoryId)?.name || 'Unknown',
            date: t.date instanceof Date
              ? t.date.toISOString()
              : new Date((t.date as { seconds: number }).seconds * 1000).toISOString(),
            description: t.description || '',
          };
        })
      );

      return {
        transactions: transactionsWithConversion,
        categories: categories.map((c) => ({
          name: c.name,
          type: c.type,
        })),
        accounts: accounts.map((a) => ({
          name: a.name,
          balance: a.balance,
          currency: a.currency,
        })),
        totalBalance,
        baseCurrency: settings.baseCurrency,
        currentDate: new Date().toLocaleDateString('uk-UA', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      };
    } catch (error) {
      console.error('Failed to get financial context:', error);
      return null;
    }
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || !userId || loading) return;

    setLoading(true);
    setInput('');

    // Add user message to UI
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      userId,
      role: 'user',
      content: messageText,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Save user message to Firestore (don't await - do in background)
      chatMessageRepository.create(userId, {
        role: 'user',
        content: messageText,
      }).catch((err) => console.error('Failed to save user message:', err));

      // Get financial context
      const financialContext = await getFinancialContext();

      if (!financialContext) {
        throw new Error('Failed to load financial data');
      }

      // Send to AI
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          financialContext,
          chatHistory: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get AI response');
      }

      // Add AI response to UI
      const aiMessage: ChatMessage = {
        id: `temp-ai-${Date.now()}`,
        userId,
        role: 'assistant',
        content: data.response,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);

      // Save AI response to Firestore (don't await - do in background)
      chatMessageRepository.create(userId, {
        role: 'assistant',
        content: data.response,
      }).catch((err) => console.error('Failed to save AI response:', err));
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        userId,
        role: 'assistant',
        content: 'Sorry, an error occurred. Please try again later.',
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt);
  };

  const clearHistory = async () => {
    if (!userId) return;
    try {
      await chatMessageRepository.deleteAllForUser(userId);
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const copyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full sm:w-96 max-w-full bg-background border-l border-border z-50 transform transition-transform duration-300 ease-in-out flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">AI Assistant</h2>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                title="Clear history"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Hi! I&apos;m your financial assistant.
                <br />
                Ask me about your finances!
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex group',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div className="flex items-start gap-1 max-w-[85%]">
                  {message.role === 'assistant' && (
                    <button
                      onClick={() => copyMessage(message.id, message.content)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded mt-1 flex-shrink-0"
                      title="Copy message"
                    >
                      {copiedId === message.id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  )}
                  <div
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm prose-invert max-w-none
                        prose-p:my-3 prose-p:leading-relaxed
                        prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-semibold
                        prose-h3:text-base prose-h3:text-foreground
                        prose-ul:my-3 prose-ul:pl-4
                        prose-ol:my-3 prose-ol:pl-4
                        prose-li:my-1 prose-li:pl-1
                        prose-strong:text-foreground prose-strong:font-semibold
                        prose-em:text-muted-foreground
                        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                        [&_ul]:list-disc [&_ol]:list-decimal
                      ">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <button
                      onClick={() => copyMessage(message.id, message.content)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded mt-1 flex-shrink-0"
                      title="Copy message"
                    >
                      {copiedId === message.id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions - always visible */}
        {!loading && (
          <div className="px-4 pb-2 flex-shrink-0">
            <p className="text-xs text-muted-foreground mb-2">Quick actions:</p>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_QUICK_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-full transition-colors"
                >
                  <span>{action.icon}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={loading || !userId}
              className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || loading || !userId}
              className="h-10 w-10 p-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
