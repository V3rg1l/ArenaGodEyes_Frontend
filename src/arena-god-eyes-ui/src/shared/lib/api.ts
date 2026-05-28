import type {
  AppSettings,
  ChatGptPromptExport,
  ImportedMatchesResult,
  ManualAnalysisImportResult,
  MatchLibraryItem,
  MatchReviewDetails,
  ObsConnectionStatus,
  ObsRecordingStartResult,
  ObsRecordingStopResult,
  SettingsValidationResult,
  SystemStatus,
  VideoClipGenerationResult,
  VideoProcessingResult,
} from "../types/api";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:5188";

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export const api = {
  getSystemStatus: () => request<SystemStatus>("/api/system/status"),
  getSettings: () => request<AppSettings>("/api/settings"),
  saveSettings: (settings: AppSettings) =>
    request<AppSettings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  validateSettings: (settings: AppSettings) =>
    request<SettingsValidationResult>("/api/settings/validate", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
  detectWowPath: () =>
    request<{ wowRetailPath: string | null }>("/api/settings/detect-wow", {
      method: "POST",
    }),
  installAddon: (settings: AppSettings) =>
    request("/api/settings/install-addon", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
  listMatches: () => request<MatchLibraryItem[]>("/api/matches"),
  getMatch: (matchId: string) =>
    request<MatchReviewDetails>(`/api/matches/${matchId}`),
  importSample: () =>
    request<ImportedMatchesResult>("/api/matches/import-sample", {
      method: "POST",
    }),
  importLog: (filePath: string) =>
    request<ImportedMatchesResult>("/api/matches/import-log", {
      method: "POST",
      body: JSON.stringify({ filePath }),
    }),
  attachVideo: (matchId: string, videoPath: string) =>
    request(`/api/matches/${matchId}/attach-video`, {
      method: "POST",
      body: JSON.stringify({ videoPath }),
    }),
  exportPrompt: (matchId: string) =>
    request<ChatGptPromptExport>(`/api/matches/${matchId}/export-chatgpt-prompt`, {
      method: "POST",
    }),
  getObsStatus: () => request<ObsConnectionStatus>("/api/video/obs/status"),
  testObsConnection: () =>
    request<ObsConnectionStatus>("/api/video/obs/test-connection", {
      method: "POST",
    }),
  startObsRecording: (matchId: string | null) =>
    request<ObsRecordingStartResult>("/api/video/obs/start-recording", {
      method: "POST",
      body: JSON.stringify({ matchId }),
    }),
  stopObsRecording: (matchId: string | null) =>
    request<ObsRecordingStopResult>("/api/video/obs/stop-recording", {
      method: "POST",
      body: JSON.stringify({ matchId }),
    }),
  processMatchVideo: (matchId: string) =>
    request<VideoProcessingResult>(`/api/matches/${matchId}/process-video`, {
      method: "POST",
    }),
  generateReviewClips: (matchId: string) =>
    request<VideoClipGenerationResult>(`/api/matches/${matchId}/generate-review-clips`, {
      method: "POST",
    }),
  importManualAnalysis: (matchId: string, responseText: string) =>
    request<ManualAnalysisImportResult>(`/api/matches/${matchId}/manual-analysis`, {
      method: "POST",
      body: JSON.stringify({ responseText }),
    }),
};
