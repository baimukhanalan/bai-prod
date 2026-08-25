export {};
declare global {
  interface Window {
    Telegram?: { WebApp: {
      initData: string;
      ready(): void;
      expand(): void;
      setHeaderColor(color: string): void;
      setBackgroundColor(color: string): void;
      openTelegramLink?(url: string): void;
      openLink?(url: string): void;
      HapticFeedback?: { impactOccurred(style: 'light' | 'medium' | 'heavy'): void; notificationOccurred(type: 'success' | 'error'): void };
    }};
  }
}
