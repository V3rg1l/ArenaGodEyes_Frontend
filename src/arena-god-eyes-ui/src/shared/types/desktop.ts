export type DesktopWowWindow = {
  handle: number;
  processId: number;
  processName: string;
  title: string;
  className: string;
  executablePath: string | null;
  executableName: string | null;
};

export type DesktopObsLaunchStatus = {
  detected: boolean;
  launched: boolean;
  path: string | null;
  errorMessage: string | null;
};

export type DesktopCaptureSource = {
  id: string;
  name: string;
  displayId: string | null;
};

export type DesktopBridge = {
  isDesktop: boolean;
  selectCombatLogFile: () => Promise<string | null>;
  selectVideoFile: () => Promise<string | null>;
  selectDirectory: () => Promise<string | null>;
  listWowWindows: () => Promise<DesktopWowWindow[]>;
  listCaptureSources: () => Promise<DesktopCaptureSource[]>;
  saveRecordingBuffer: (payload: {
    directoryPath: string;
    fileName: string;
    arrayBuffer: ArrayBuffer;
  }) => Promise<string>;
  ensureObsRunning: () => Promise<DesktopObsLaunchStatus>;
};

declare global {
  interface Window {
    arenaGodEyesDesktop?: DesktopBridge;
  }
}

export {};
