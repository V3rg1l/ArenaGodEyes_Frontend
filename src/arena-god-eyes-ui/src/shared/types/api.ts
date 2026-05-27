export type AppSettings = {
  id: number;
  wowRetailPath: string | null;
  combatLogDirectory: string | null;
  addonDirectory: string | null;
  recordingDirectory: string | null;
  recordingCacheDirectory: string | null;
  obsHost: string;
  obsPort: number;
  obsPassword: string | null;
  enableObsRecording: boolean;
  enableObsAutoConnect: boolean;
  maxDiskStorageGb: number;
  maxMatchFiles: number;
  trackSkirmishMatches: boolean;
  enableMatchDetection: boolean;
  enableRecording: boolean;
  runAtStartup: boolean;
  minimizeToTrayOnClose: boolean;
  showMmrBadge: boolean;
  showOnlyMyMistakesByDefault: boolean;
  useListViewForMatches: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SettingsValidationResult = {
  isValid: boolean;
  wowRetailPathExists: boolean;
  combatLogDirectoryExists: boolean;
  addonDirectoryExists: boolean;
  addonInstalled: boolean;
  messages: string[];
};

export type MatchLibraryItem = {
  matchId: string;
  startedAt: string;
  bracket: string;
  mapName: string;
  durationSeconds: number;
  resultForPlayer: string | null;
  playerName: string | null;
  playerSpecLabel: string | null;
  hasVideo: boolean;
  hasManualAnalysis: boolean;
  timelineMarkerCount: number;
  matchJsonPath: string;
  videoLocalPath: string | null;
};

export type TimelineMarkerItem = {
  videoSecond: number;
  category: string;
  severity: string;
  label: string;
  description: string;
  source: string;
};

export type MatchReviewDetails = {
  match: MatchLibraryItem;
  matchJson: string;
  promptText: string | null;
  manualAnalysisText: string | null;
  timelineMarkers: TimelineMarkerItem[];
};

export type ImportedMatchSummary = {
  matchId: string;
  bracket: string;
  mapId: number;
  mapName: string;
  durationSeconds: number;
  chunkFilePath: string;
  matchJsonPath: string;
};

export type ImportedMatchesResult = {
  sourceFilePath: string;
  sourceLineCount: number;
  matchCount: number;
  parseErrorCount: number;
  matches: ImportedMatchSummary[];
};

export type ChatGptPromptExport = {
  matchId: string;
  promptPath: string;
  promptText: string;
};

export type ManualAnalysisImportResult = {
  matchId: string;
  responsePath: string;
  markerCount: number;
  storedProvider: string;
};

export type SystemStatus = {
  name: string;
  version: string;
  tagline: string;
  status: string;
  safety: string;
  utcNow: string;
};
