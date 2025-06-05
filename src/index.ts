import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChatWidget, ChatWidgetProps } from './ChatWidget';
import { useChatStore } from './store/chatStore';
import './index.css';
import { configureApi } from '@schmitech/chatbot-api';
import { getChatConfig, ChatConfig } from './config/index';
import { getOrCreateSessionId, setSessionId } from './utils/sessionManager';

export { ChatWidget, useChatStore, getChatConfig };
export type { ChatWidgetProps, ChatConfig };

// Also export as default for backward compatibility
export default ChatWidget;

// This will be the global API URL that components can import
let apiUrl: string | null = null;
let apiKey: string | null = null;
let currentConfig: ChatConfig | null = null;

export function getApiUrl(): string {
  if (!apiUrl) {
    if (typeof window !== 'undefined' && window.CHATBOT_API_URL) {
      apiUrl = window.CHATBOT_API_URL;
    } else {
      throw new Error('API URL not set. Call setApiUrl or use injectChatWidget to configure the API URL.');
    }
  }
  return apiUrl;
}

export function getApiKey(): string {
  if (!apiKey) {
    if (typeof window !== 'undefined' && window.CHATBOT_API_KEY) {
      apiKey = window.CHATBOT_API_KEY;
    } else {
      throw new Error('API key not set. Call setApiKey or use injectChatWidget to configure the API key.');
    }
  }
  return apiKey;
}

export function setApiUrl(url: string): void {
  apiUrl = url;
  if (typeof window !== 'undefined') {
    window.CHATBOT_API_URL = url;
    // Configure the API with both URL and key
    if (apiKey) {
      const sessionId = getOrCreateSessionId();
      configureApi(url, apiKey, sessionId);
    }
  }
}

export function setApiKey(key: string): void {
  apiKey = key;
  if (typeof window !== 'undefined') {
    window.CHATBOT_API_KEY = key;
    // Configure the API with both URL and key
    if (apiUrl) {
      const sessionId = getOrCreateSessionId();
      configureApi(apiUrl, key, sessionId);
    }
  }
}

// Function to update widget configuration at runtime
export function updateWidgetConfig(config: Partial<ChatConfig>): void {
  if (typeof window === 'undefined') return;
  
  currentConfig = {
    ...getChatConfig(),  // Start with default config
    ...currentConfig,  // Keep existing config
    ...config,         // Apply new config
    // Ensure required properties are present
    header: {
      ...getChatConfig().header,  // Keep default header
      ...currentConfig?.header, // Keep existing header
      ...config.header         // Apply new header
    },
    welcome: {
      ...getChatConfig().welcome,  // Keep default welcome
      ...currentConfig?.welcome, // Keep existing welcome
      ...config.welcome         // Apply new welcome
    },
    suggestedQuestions: config.suggestedQuestions || currentConfig?.suggestedQuestions || getChatConfig().suggestedQuestions,
    theme: {
      ...getChatConfig().theme,  // Keep default theme
      ...currentConfig?.theme, // Keep existing theme
      ...config.theme         // Apply new theme
    }
  };
  
  // Dispatch a custom event to notify the widget of the config change
  window.dispatchEvent(new CustomEvent('chatbot-config-update', { 
    detail: currentConfig 
  }));
}

// Function to inject the widget into any website
export function injectChatWidget(config: {
  apiUrl: string;
  apiKey: string;
  sessionId?: string;
  containerSelector?: string;
  widgetConfig?: Partial<ChatConfig>;
}) {
  try {
    // Handle session ID
    let sessionId: string;
    if (config.sessionId) {
      // If a session ID is provided, use it and persist it
      sessionId = config.sessionId;
      setSessionId(sessionId);
    } else {
      // Otherwise, get or create a persistent session ID
      sessionId = getOrCreateSessionId();
    }

    // Set global variables first
    window.CHATBOT_API_URL = config.apiUrl;
    window.CHATBOT_API_KEY = config.apiKey;
    window.CHATBOT_SESSION_ID = sessionId;

    // Update widget config if provided
    if (config.widgetConfig) {
      updateWidgetConfig(config.widgetConfig);
    }

    // Configure the API with the consistent session ID
    configureApi(config.apiUrl, config.apiKey, sessionId);

    const container = document.querySelector(config.containerSelector || '#chatbot-widget');
    if (!container) {
      console.error('Chatbot container not found');
      return;
    }

    const root = ReactDOM.createRoot(container);
    root.render(
      React.createElement(ChatWidget, {
        sessionId: sessionId,
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        ...config.widgetConfig
      })
    );
  } catch (error) {
    console.error('Failed to inject chatbot widget:', error);
  }
}

// Make sure to set it on window for UMD builds
if (typeof window !== 'undefined') {
  // Initialize the widget when the page loads
  window.initChatbotWidget = (config: {
    apiUrl: string;
    apiKey: string;
    sessionId?: string;
    containerSelector?: string;
    widgetConfig?: Partial<ChatConfig>;
  }) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => injectChatWidget(config));
    } else {
      injectChatWidget(config);
    }
  };

  // Expose additional utilities
  window.ChatbotWidget = {
    ChatWidget,
    useChatStore,
    injectChatWidget,
    setApiUrl,
    getApiUrl,
    setApiKey,
    getApiKey,
    updateWidgetConfig,
    configureApi: (apiUrl: string, apiKey: string, sessionId?: string) => {
      const finalSessionId = sessionId || getOrCreateSessionId();
      if (sessionId) {
        setSessionId(sessionId);
      }
      configureApi(apiUrl, apiKey, finalSessionId);
    }
  };
} 