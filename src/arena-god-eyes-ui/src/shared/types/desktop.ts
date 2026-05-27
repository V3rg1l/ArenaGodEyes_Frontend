export type DesktopBridge = {
  isDesktop: boolean;
  selectCombatLogFile: () => Promise<string | null>;
  selectVideoFile: () => Promise<string | null>;
  selectDirectory: () => Promise<string | null>;
};

declare global {
  interface Window {
    arenaGodEyesDesktop?: DesktopBridge;
  }
}

export {};
