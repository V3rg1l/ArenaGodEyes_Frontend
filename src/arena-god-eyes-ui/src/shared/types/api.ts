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
  obsConnectTimeoutSeconds: number;
  ffmpegExecutablePath: string | null;
  ffprobeExecutablePath: string | null;
  videoThumbnailSecond: number;
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
  playerClassName: string | null;
  playerSpecLabel: string | null;
  hasVideo: boolean;
  hasManualAnalysis: boolean;
  timelineMarkerCount: number;
  matchJsonPath: string;
  videoLocalPath: string | null;
  thumbnailPath: string | null;
  recordingStatus: string | null;
  videoDurationSeconds: number | null;
  videoResolution: string | null;
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
  specPerformanceSnapshot: SpecPerformanceSnapshotItem | null;
  metricSummary: MatchMetricSummaryItem | null;
  spellMetrics: MatchSpellMetricItem[];
  coachKnowledgeParameters: CoachKnowledgeParameterItem[];
  coachSkills: CoachSkillItem[];
  timelineMarkers: TimelineMarkerItem[];
  insights: AnalysisInsightItem[];
  validationTargets: ValidationTargetItem[];
  videoClips: VideoClipItem[];
};

export type MatchMetricSummaryItem = {
  totalCasts: number;
  totalDamage: number;
  totalHealing: number;
  interruptCount: number;
  deathCount: number;
  damagePerSecond: number;
  healingPerSecond: number;
  castsPerMinute: number;
};

export type MatchSpellMetricItem = {
  spellName: string;
  normalizedSpellName: string;
  castCount: number;
  totalDamage: number;
  totalHealing: number;
  className: string | null;
  specLabel: string | null;
  primaryCategory: string | null;
  tacticalPhase: string | null;
  isSignatureSpell: boolean;
};

export type CoachKnowledgeParameterItem = {
  scope: string;
  className: string | null;
  specLabel: string | null;
  category: string;
  metric: string;
  targetValue: string | null;
  unit: string | null;
  note: string | null;
  source: string;
  evidenceCount: number;
  updatedAt: string;
};

export type CoachSkillItem = {
  scope: string;
  className: string | null;
  specLabel: string | null;
  area: string;
  goal: string;
  drill: string | null;
  source: string;
  evidenceCount: number;
  updatedAt: string;
};

export type AnalysisInsightItem = {
  videoSecond: number | null;
  category: string;
  severity: string;
  title: string;
  summary: string;
  evidence: string | null;
  recommendation: string | null;
  source: string;
};

export type SpecPerformanceSnapshotItem = {
  className: string | null;
  specLabel: string | null;
  recognizedSpellCount: number;
  coreSpellUsageCount: number;
  burstSpellUsageCount: number;
  defensiveSpellUsageCount: number;
  controlSpellUsageCount: number;
  interruptSpellUsageCount: number;
  mobilitySpellUsageCount: number;
};

export type ValidationTargetItem = {
  videoSecond: number | null;
  category: string;
  metric: string;
  currentValue: string | null;
  expectedValue: string | null;
  unit: string | null;
  note: string | null;
  source: string;
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

export type ObsConnectionStatus = {
  isConfigured: boolean;
  isReachable: boolean;
  isAuthenticated: boolean;
  isRecording: boolean;
  obsVersion: string | null;
  outputPath: string | null;
  errorMessage: string | null;
};

export type ObsRecordingStartResult = {
  started: boolean;
  wasAlreadyRecording: boolean;
  matchId: string | null;
  message: string | null;
};

export type ObsRecordingStopResult = {
  stopped: boolean;
  matchId: string | null;
  outputPath: string | null;
  finalVideoPath: string | null;
  attachedToMatch: boolean;
  message: string | null;
};

export type VideoProcessingResult = {
  matchId: string;
  videoPath: string;
  thumbnailPath: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  framesPerSecond: number | null;
  codec: string | null;
  resolution: string | null;
  processedAt: string;
};

export type VideoClipItem = {
  videoSecond: number;
  startSecond: number;
  endSecond: number;
  label: string;
  category: string;
  source: string;
  clipPath: string;
  createdAt: string;
};

export type VideoClipGenerationResult = {
  matchId: string;
  generatedClipCount: number;
  clips: VideoClipItem[];
};
