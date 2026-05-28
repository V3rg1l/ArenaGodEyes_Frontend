import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TimelineMarkerRail } from "../../shared/components/TimelineMarkerRail";
import { api } from "../../shared/lib/api";
import type {
  AppSettings,
  CoachKnowledgeParameterItem,
  CoachSkillItem,
  MatchBenchmarkComparisonItem,
  MatchLibraryItem,
  MatchReviewDetails,
  MatchSpellMetricItem,
  ObsConnectionStatus,
  RuleCoachFindingItem,
  SettingsValidationResult,
  SpecPerformanceSnapshotItem,
  SystemStatus,
} from "../../shared/types/api";
import "../../shared/styles/home-page.css";
import "../../shared/types/desktop";

const emptySettings: AppSettings = {
  id: 1,
  wowRetailPath: null,
  combatLogDirectory: null,
  addonDirectory: null,
  recordingDirectory: null,
  recordingCacheDirectory: null,
  obsHost: "127.0.0.1",
  obsPort: 4455,
  obsPassword: null,
  enableObsRecording: false,
  enableObsAutoConnect: true,
  obsConnectTimeoutSeconds: 5,
  ffmpegExecutablePath: null,
  ffprobeExecutablePath: null,
  videoThumbnailSecond: 5,
  maxDiskStorageGb: 100,
  maxMatchFiles: 1000,
  trackSkirmishMatches: true,
  enableMatchDetection: true,
  enableRecording: false,
  runAtStartup: false,
  minimizeToTrayOnClose: true,
  showMmrBadge: true,
  showOnlyMyMistakesByDefault: false,
  useListViewForMatches: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

type GlyphName =
  | "all"
  | "shuffle"
  | "three"
  | "two"
  | "skirmish"
  | "clips"
  | "details"
  | "coach"
  | "learning"
  | "settings"
  | "scene"
  | "verify"
  | "review"
  | "camera"
  | "shield"
  | "spark"
  | "status";

type AppView =
  | "all"
  | "shuffle"
  | "3v3"
  | "2v2"
  | "skirmish"
  | "clips"
  | "details"
  | "coach"
  | "learning"
  | "settings"
  | "scene"
  | "verify"
  | "review";

type SettingsTab = "storage" | "detection" | "application" | "recording" | "advanced";
type SceneTab = "source" | "video" | "audio";
type ReviewTab = "overview" | "details" | "coach" | "learning" | "chatgpt" | "json";
type CaptureMode = "game" | "window" | "monitor";

type SidebarItem = {
  key: AppView;
  label: string;
  icon: GlyphName;
};

const librarySidebarItems: SidebarItem[] = [
  { key: "all", label: "All Brackets", icon: "all" },
  { key: "shuffle", label: "Solo Shuffle", icon: "shuffle" },
  { key: "3v3", label: "3v3", icon: "three" },
  { key: "2v2", label: "2v2", icon: "two" },
  { key: "skirmish", label: "Skirmish", icon: "skirmish" },
];

const systemSidebarItems: SidebarItem[] = [
  { key: "clips", label: "Clips", icon: "clips" },
  { key: "details", label: "Details++", icon: "details" },
  { key: "coach", label: "Coach Analysis", icon: "coach" },
  { key: "learning", label: "Learning Database", icon: "learning" },
  { key: "settings", label: "Settings", icon: "settings" },
  { key: "scene", label: "Scene", icon: "scene" },
  { key: "verify", label: "Verify Setup", icon: "verify" },
];

const settingsTabs: Array<{ key: SettingsTab; label: string }> = [
  { key: "storage", label: "Storage" },
  { key: "detection", label: "Detection" },
  { key: "application", label: "Application" },
  { key: "recording", label: "Recording" },
  { key: "advanced", label: "Advanced" },
];

const sceneTabs: Array<{ key: SceneTab; label: string }> = [
  { key: "source", label: "Source" },
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
];

const reviewTabs: Array<{ key: ReviewTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "details", label: "Details++" },
  { key: "coach", label: "Coach Findings" },
  { key: "learning", label: "Learning" },
  { key: "chatgpt", label: "ChatGPT Analysis" },
  { key: "json", label: "JSON" },
];

function toLocalFileSource(path: string | null) {
  if (!path) {
    return undefined;
  }

  if (/^https?:\/\//i.test(path) || /^file:\/\//i.test(path)) {
    return path;
  }

  return `file:///${path.replace(/\\/g, "/")}`;
}

function formatDuration(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatLargeNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function titleize(input: string | null | undefined) {
  if (!input) {
    return "Unknown";
  }

  return input
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function scopeLabel(item: { scope: string; className: string | null; specLabel: string | null }) {
  if (item.scope === "spec" && item.specLabel) {
    return item.className ? `${item.className} / ${item.specLabel}` : item.specLabel;
  }

  if (item.scope === "class" && item.className) {
    return item.className;
  }

  return "Global";
}

function categoryTone(category: string | null) {
  switch (category?.toLowerCase()) {
    case "interrupt":
      return "sky";
    case "defensive":
      return "defensive";
    case "stun":
    case "fear":
    case "silence":
    case "disorient":
    case "incapacitate":
    case "horror":
    case "root":
    case "cc":
      return "magic";
    case "offensive_cooldown":
    case "damage":
    case "dot":
    case "burst":
      return "burst";
    default:
      return "stone";
  }
}

function comparisonTone(status: string) {
  switch (status) {
    case "aligned":
      return "success";
    case "below_target":
    case "above_target":
      return "danger";
    default:
      return "stone";
  }
}

function resultTone(result: string | null) {
  switch (result?.toLowerCase()) {
    case "victory":
    case "win":
      return "success";
    case "loss":
    case "lose":
      return "danger";
    default:
      return "stone";
  }
}

function isLibraryView(view: AppView) {
  return view === "all" || view === "shuffle" || view === "3v3" || view === "2v2" || view === "skirmish";
}

function matchesViewFilter(match: MatchLibraryItem, view: AppView) {
  const bracket = match.bracket.toLowerCase();

  switch (view) {
    case "shuffle":
      return bracket.includes("shuffle") || bracket.includes("solo");
    case "3v3":
      return bracket.includes("3v3") || bracket.includes("3v");
    case "2v2":
      return bracket.includes("2v2") || bracket.includes("2v");
    case "skirmish":
      return bracket.includes("skirmish");
    default:
      return true;
  }
}

function dateBucket(dateValue: string) {
  const now = new Date();
  const date = new Date(dateValue);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - startOfTarget.getTime()) / 86400000);

  if (diffDays <= 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 7) {
    return "This Week";
  }

  return "Older";
}

function Glyph({ name }: { name: GlyphName }) {
  const paths: Record<GlyphName, ReactNode> = {
    all: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </>
    ),
    shuffle: (
      <>
        <path d="M5 6h4l10 12h2" />
        <path d="m17 6 4 4-4 4" />
        <path d="M5 18h4l3-4" />
      </>
    ),
    three: (
      <>
        <circle cx="8" cy="12" r="2.5" />
        <circle cx="15" cy="9" r="2.5" />
        <circle cx="15" cy="15" r="2.5" />
      </>
    ),
    two: (
      <>
        <circle cx="8" cy="12" r="3" />
        <circle cx="16" cy="12" r="3" />
      </>
    ),
    skirmish: (
      <>
        <path d="m7 5 10 14" />
        <path d="m17 5-10 14" />
      </>
    ),
    clips: (
      <>
        <rect x="4" y="6" width="14" height="12" rx="2" />
        <path d="m18 10 3-2v8l-3-2" />
      </>
    ),
    details: (
      <>
        <path d="M5 18V9" />
        <path d="M10 18V5" />
        <path d="M15 18v-7" />
        <path d="M20 18v-4" />
      </>
    ),
    coach: (
      <>
        <path d="M12 4a6 6 0 0 1 3.6 10.8c-.8.6-1.3 1.4-1.6 2.2h-4c-.3-.8-.8-1.6-1.6-2.2A6 6 0 0 1 12 4Z" />
        <path d="M9.5 20h5" />
      </>
    ),
    learning: (
      <>
        <path d="M5 7.5 12 4l7 3.5-7 3.5Z" />
        <path d="M5 12.5 12 16l7-3.5" />
        <path d="M5 17.5 12 21l7-3.5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.7l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.7-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.7.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.7 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.7.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.7v.1a1.6 1.6 0 0 0 1.5 1.1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" />
      </>
    ),
    scene: (
      <>
        <rect x="3.5" y="5.5" width="17" height="11" rx="2.5" />
        <path d="M8 19h8" />
      </>
    ),
    verify: (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    ),
    review: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M9 10h6" />
        <path d="M9 14h3" />
      </>
    ),
    camera: (
      <>
        <rect x="3.5" y="6.5" width="17" height="11" rx="2.5" />
        <path d="m20.5 9.5 4-2v9l-4-2" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 20 6v5c0 5-3.3 8.3-8 10-4.7-1.7-8-5-8-10V6z" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3v5" />
        <path d="m8 11 4-3 4 3-4 10z" />
      </>
    ),
    status: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </>
    ),
  };

  return (
    <span className="glyph-shell" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {paths[name]}
      </svg>
    </span>
  );
}

function SnapshotRail({ snapshot }: { snapshot: SpecPerformanceSnapshotItem | null }) {
  if (!snapshot) {
    return (
      <div className="metric-mini-grid">
        <article className="mini-stat-card">
          <span>No spec profile yet</span>
          <strong>Import more matches</strong>
        </article>
      </div>
    );
  }

  const items = [
    ["Recognized", snapshot.recognizedSpellCount],
    ["Core", snapshot.coreSpellUsageCount],
    ["Burst", snapshot.burstSpellUsageCount],
    ["Defensive", snapshot.defensiveSpellUsageCount],
    ["Control", snapshot.controlSpellUsageCount],
    ["Interrupt", snapshot.interruptSpellUsageCount],
  ] as const;

  return (
    <div className="metric-mini-grid">
      {items.map(([label, value]) => (
        <article key={label} className="mini-stat-card">
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

function SpellMetricCard({ metric }: { metric: MatchSpellMetricItem }) {
  return (
    <article className="intel-card">
      <div className="intel-card-topline">
        <strong>{metric.spellName}</strong>
        <span className={`tone-chip tone-${categoryTone(metric.primaryCategory)}`}>
          {titleize(metric.primaryCategory ?? metric.tacticalPhase ?? "unknown")}
        </span>
      </div>
      <p className="muted-copy">
        {(metric.className ?? "Unknown class") +
          (metric.specLabel ? ` / ${metric.specLabel}` : "") +
          (metric.tacticalPhase ? ` / ${titleize(metric.tacticalPhase)}` : "")}
      </p>
      <div className="intel-metrics">
        <span>casts {metric.castCount}</span>
        <span>damage {formatLargeNumber(metric.totalDamage)}</span>
        <span>healing {formatLargeNumber(metric.totalHealing)}</span>
      </div>
      {metric.isSignatureSpell ? <p className="signature-flag">Signature spell for inferred spec</p> : null}
    </article>
  );
}

function KnowledgeCard({ item }: { item: CoachKnowledgeParameterItem }) {
  return (
    <article className="intel-card">
      <div className="intel-card-topline">
        <strong>{item.metric}</strong>
        <span className={`tone-chip tone-${categoryTone(item.category)}`}>{titleize(item.category)}</span>
      </div>
      <p className="muted-copy">
        {scopeLabel(item)} / target {item.targetValue ?? "unknown"}
        {item.unit ? ` (${item.unit})` : ""} / evidence {item.evidenceCount}
      </p>
      {item.note ? <p>{item.note}</p> : null}
    </article>
  );
}

function SkillCard({ item }: { item: CoachSkillItem }) {
  return (
    <article className="intel-card">
      <div className="intel-card-topline">
        <strong>{item.area}</strong>
        <span className="tone-chip tone-stone">{scopeLabel(item)}</span>
      </div>
      <p>{item.goal}</p>
      <p className="muted-copy">Evidence {item.evidenceCount}</p>
      {item.drill ? <p>{item.drill}</p> : null}
    </article>
  );
}

function BenchmarkComparisonCard({ item }: { item: MatchBenchmarkComparisonItem }) {
  return (
    <article className="intel-card">
      <div className="intel-card-topline">
        <strong>{titleize(item.metric)}</strong>
        <span className={`tone-chip tone-${comparisonTone(item.status)}`}>
          {titleize(item.status)}
        </span>
      </div>
      <p className="muted-copy">
        {scopeLabel(item)} / {titleize(item.category)} / evidence {item.evidenceCount}
      </p>
      <p>
        {item.currentValue ?? "unknown"} {"->"} {item.expectedValue ?? "target"}
        {item.unit ? ` (${item.unit})` : ""}
      </p>
      {item.note ? <p className="muted-copy">{item.note}</p> : null}
    </article>
  );
}

function RuleCoachFindingCard({ item }: { item: RuleCoachFindingItem }) {
  return (
    <article className="intel-card">
      <div className="intel-card-topline">
        <strong>{item.title}</strong>
        <span className={`tone-chip tone-${item.severity === "high" ? "danger" : "warning"}`}>
          {titleize(item.severity)}
        </span>
      </div>
      <p className="muted-copy">
        {item.scope} / {titleize(item.category)}
        {item.relatedMetric ? ` / ${titleize(item.relatedMetric)}` : ""}
      </p>
      <p>{item.summary}</p>
      <p className="muted-copy">{item.evidence}</p>
      <p>{item.recommendation}</p>
    </article>
  );
}

type SettingsRowProps = {
  title: string;
  description: string;
  controls: ReactNode;
};

function SettingsRow({ title, description, controls }: SettingsRowProps) {
  return (
    <article className="settings-row">
      <div className="settings-row-copy">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className="settings-row-controls">{controls}</div>
    </article>
  );
}

export function HomePage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [settings, setSettings] = useState<AppSettings>(emptySettings);
  const [validation, setValidation] = useState<SettingsValidationResult | null>(null);
  const [obsStatus, setObsStatus] = useState<ObsConnectionStatus | null>(null);
  const [matches, setMatches] = useState<MatchLibraryItem[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchReviewDetails | null>(null);
  const [manualResponseText, setManualResponseText] = useState("");
  const [promptText, setPromptText] = useState("");
  const [statusMessage, setStatusMessage] = useState("Workspace warming up.");
  const [isBusy, setIsBusy] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("all");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("storage");
  const [activeSceneTab, setActiveSceneTab] = useState<SceneTab>("source");
  const [activeReviewTab, setActiveReviewTab] = useState<ReviewTab>("overview");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [onlyWithVideo, setOnlyWithVideo] = useState(false);
  const [onlyNeedsAnalysis, setOnlyNeedsAnalysis] = useState(false);
  const [showSensitiveValues, setShowSensitiveValues] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("window");
  const [captureCursor, setCaptureCursor] = useState(true);
  const [sceneTarget, setSceneTarget] = useState<"wow-a" | "wow-b" | "auto">("wow-a");

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!selectedMatchId) {
      return;
    }

    void loadMatch(selectedMatchId);
  }, [selectedMatchId]);

  const pendingAnalyses = useMemo(
    () => matches.filter((match) => !match.hasManualAnalysis).length,
    [matches],
  );

  const libraryStats = useMemo(
    () => ({
      total: matches.length,
      analyzed: matches.filter((match) => match.hasManualAnalysis).length,
      withVideo: matches.filter((match) => match.hasVideo).length,
    }),
    [matches],
  );

  const filteredMatches = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();

    return matches.filter((match) => {
      if (isLibraryView(activeView) && !matchesViewFilter(match, activeView)) {
        return false;
      }

      if (onlyWithVideo && !match.hasVideo) {
        return false;
      }

      if (onlyNeedsAnalysis && match.hasManualAnalysis) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        match.playerName,
        match.playerClassName,
        match.playerSpecLabel,
        match.bracket,
        match.mapName,
        match.resultForPlayer,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [activeView, libraryQuery, matches, onlyNeedsAnalysis, onlyWithVideo]);

  const groupedMatches = useMemo(() => {
    const buckets: Record<string, MatchLibraryItem[]> = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Older: [],
    };

    filteredMatches.forEach((match) => {
      buckets[dateBucket(match.startedAt)].push(match);
    });

    return buckets;
  }, [filteredMatches]);

  const categorizedSpells = useMemo(() => {
    if (!selectedMatch) {
      return [];
    }

    return [...selectedMatch.spellMetrics]
      .sort(
        (left, right) =>
          right.castCount + right.totalDamage + right.totalHealing -
          (left.castCount + left.totalDamage + left.totalHealing),
      )
      .slice(0, 12);
  }, [selectedMatch]);

  const sceneSources = useMemo(
    () => [
      {
        key: "wow-a" as const,
        title: "WoW Session A",
        description: settings.wowRetailPath
          ? "Primary configured client and preferred queue window."
          : "Primary client slot for your main WoW window.",
      },
      {
        key: "wow-b" as const,
        title: "WoW Session B",
        description: "Secondary open WoW client, alt account, or second monitor session.",
      },
      {
        key: "auto" as const,
        title: "Auto active WoW",
        description: "Use the active session target when the app starts a recording workflow.",
      },
    ],
    [settings.wowRetailPath],
  );

  async function loadDashboard() {
    setIsBusy(true);
    try {
      const [statusResult, settingsResult, matchesResult] = await Promise.all([
        api.getSystemStatus(),
        api.getSettings(),
        api.listMatches(),
      ]);

      setSystemStatus(statusResult);
      setSettings(settingsResult);
      setMatches(matchesResult);
      setSelectedMatchId((current) => current ?? matchesResult[0]?.matchId ?? null);
      const latestObsStatus = await api.getObsStatus();
      setObsStatus(latestObsStatus);
      setStatusMessage("Backend online. Ready for post-match review and coach learning.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to load dashboard.");
    } finally {
      setIsBusy(false);
    }
  }

  async function loadMatch(matchId: string) {
    try {
      const match = await api.getMatch(matchId);
      setSelectedMatch(match);
      setPromptText(match.promptText ?? "");
      setManualResponseText(match.manualAnalysisText ?? "");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to load match.");
    }
  }

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function chooseDirectoryFor(
    key: "recordingDirectory" | "recordingCacheDirectory" | "wowRetailPath" | "combatLogDirectory",
    label: string,
  ) {
    const desktopPath = await window.arenaGodEyesDesktop?.selectDirectory();
    const fallbackPath = desktopPath ?? window.prompt(`Paste ${label.toLowerCase()} path:`);

    if (!fallbackPath) {
      return;
    }

    updateSetting(key, fallbackPath);
  }

  async function handleSaveSettings() {
    setIsBusy(true);
    try {
      const updated = await api.saveSettings(settings);
      setSettings(updated);
      setStatusMessage("Settings saved locally.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleValidateSettings() {
    setIsBusy(true);
    try {
      const result = await api.validateSettings(settings);
      setValidation(result);
      setStatusMessage(result.isValid ? "Settings look healthy." : "Settings need attention.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to validate settings.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDetectWowPath() {
    setIsBusy(true);
    try {
      const result = await api.detectWowPath();
      if (result.wowRetailPath) {
        setSettings((current) => ({
          ...current,
          wowRetailPath: result.wowRetailPath,
          combatLogDirectory: `${result.wowRetailPath}\\Logs`,
          addonDirectory: `${result.wowRetailPath}\\Interface\\AddOns\\ArenaGodEyes`,
        }));
        setStatusMessage("Detected a WoW retail path candidate.");
      } else {
        setStatusMessage("No WoW retail path was detected automatically.");
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to detect WoW path.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleInstallAddon() {
    setIsBusy(true);
    try {
      await api.installAddon(settings);
      setStatusMessage("Addon copied to the configured WoW folder.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to install addon.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRefreshObsStatus() {
    setIsBusy(true);
    try {
      const result = await api.getObsStatus();
      setObsStatus(result);
      setStatusMessage(result.errorMessage ?? "OBS status refreshed.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to load OBS status.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleTestObsConnection() {
    setIsBusy(true);
    try {
      const result = await api.testObsConnection();
      setObsStatus(result);
      setStatusMessage(result.isReachable ? "OBS connection succeeded." : result.errorMessage ?? "OBS connection failed.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to test OBS.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStartObsRecording() {
    setIsBusy(true);
    try {
      const result = await api.startObsRecording(selectedMatchId);
      await handleRefreshObsStatus();
      setStatusMessage(result.message ?? "OBS recording started.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to start OBS recording.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStopObsRecording() {
    setIsBusy(true);
    try {
      const result = await api.stopObsRecording(selectedMatchId);
      await refreshMatches(selectedMatchId);
      await handleRefreshObsStatus();
      setStatusMessage(result.message ?? "OBS recording stopped.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to stop OBS recording.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleImportSample() {
    setIsBusy(true);
    try {
      const result = await api.importSample();
      await refreshMatches(result.matches[0]?.matchId ?? null);
      setStatusMessage(`Imported ${result.matchCount} sample match(es).`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to import sample.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleImportCombatLog() {
    const desktopPath = await window.arenaGodEyesDesktop?.selectCombatLogFile();
    const fallbackPath = desktopPath ?? window.prompt("Paste a combat log or chunk file path:");

    if (!fallbackPath) {
      return;
    }

    setIsBusy(true);
    try {
      const result = await api.importLog(fallbackPath);
      await refreshMatches(result.matches[0]?.matchId ?? null);
      setStatusMessage(`Imported ${result.matchCount} match(es) from ${fallbackPath}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to import log.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAttachVideo() {
    if (!selectedMatchId) {
      return;
    }

    const desktopPath = await window.arenaGodEyesDesktop?.selectVideoFile();
    const fallbackPath = desktopPath ?? window.prompt("Paste a local video file path:");

    if (!fallbackPath) {
      return;
    }

    setIsBusy(true);
    try {
      await api.attachVideo(selectedMatchId, fallbackPath);
      await loadMatch(selectedMatchId);
      await refreshMatches(selectedMatchId);
      setStatusMessage("Video path linked to the selected match.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to attach video.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleProcessVideo() {
    if (!selectedMatchId) {
      return;
    }

    setIsBusy(true);
    try {
      const result = await api.processMatchVideo(selectedMatchId);
      await loadMatch(selectedMatchId);
      await refreshMatches(selectedMatchId);
      setStatusMessage(`Video processed. Resolution: ${result.resolution ?? "unknown"}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to process video.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleGenerateReviewClips() {
    if (!selectedMatchId) {
      return;
    }

    setIsBusy(true);
    try {
      const result = await api.generateReviewClips(selectedMatchId);
      await loadMatch(selectedMatchId);
      setStatusMessage(`Generated ${result.generatedClipCount} review clip(s).`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to generate review clips.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleExportPrompt() {
    if (!selectedMatchId) {
      return;
    }

    setIsBusy(true);
    try {
      const result = await api.exportPrompt(selectedMatchId);
      setPromptText(result.promptText);
      setStatusMessage(`Prompt exported to ${result.promptPath}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to export prompt.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleImportManualAnalysis() {
    if (!selectedMatchId || !manualResponseText.trim()) {
      return;
    }

    setIsBusy(true);
    try {
      const result = await api.importManualAnalysis(selectedMatchId, manualResponseText);
      await loadMatch(selectedMatchId);
      await refreshMatches(selectedMatchId);
      setStatusMessage(`Imported manual analysis and created ${result.markerCount} marker(s).`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to import manual analysis.");
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshMatches(preferredMatchId: string | null) {
    const refreshedMatches = await api.listMatches();
    setMatches(refreshedMatches);
    const nextId = preferredMatchId ?? refreshedMatches[0]?.matchId ?? null;
    setSelectedMatchId(nextId);

    if (nextId) {
      await loadMatch(nextId);
    } else {
      setSelectedMatch(null);
      setPromptText("");
      setManualResponseText("");
    }
  }

  function openMatch(matchId: string) {
    setSelectedMatchId(matchId);
    setActiveView("review");
    setActiveReviewTab("overview");
  }

  function handleSidebarNavigation(view: AppView) {
    if (view === "details") {
      if (selectedMatchId) {
        setActiveView("review");
        setActiveReviewTab("details");
      } else {
        setActiveView("all");
        setStatusMessage("Select a match first to open Details++.");
      }

      return;
    }

    if (view === "coach") {
      if (selectedMatchId) {
        setActiveView("review");
        setActiveReviewTab("coach");
      } else {
        setActiveView("all");
        setStatusMessage("Select a match first to open Coach Analysis.");
      }

      return;
    }

    if (view === "learning") {
      if (selectedMatchId) {
        setActiveView("review");
        setActiveReviewTab("learning");
      } else {
        setActiveView("all");
        setStatusMessage("Select a match first to open the Learning Database.");
      }

      return;
    }

    setActiveView(view);
  }

  function renderLibraryScreen() {
    return (
      <div className="workspace-page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Arena library</p>
            <h1>{librarySidebarItems.find((item) => item.key === activeView)?.label ?? "Match Library"}</h1>
            <p className="page-copy">
              Filter matches by bracket, keep clips and reviews together, and open a full replay workstation when a match needs deeper coaching.
            </p>
          </div>
          <div className="page-actions">
            <button onClick={handleImportSample} disabled={isBusy} type="button">
              Import Sample
            </button>
            <button onClick={handleImportCombatLog} disabled={isBusy} type="button">
              Import Combat Log
            </button>
          </div>
        </header>

        <section className="toolbar-card">
          <div className="toolbar-row">
            <input
              className="search-input"
              placeholder="Search player, spec, map, bracket..."
              value={libraryQuery}
              onChange={(event) => setLibraryQuery(event.target.value)}
            />
            <button
              className={`filter-toggle ${onlyWithVideo ? "active" : ""}`}
              onClick={() => setOnlyWithVideo((current) => !current)}
              type="button"
            >
              With video
            </button>
            <button
              className={`filter-toggle ${onlyNeedsAnalysis ? "active" : ""}`}
              onClick={() => setOnlyNeedsAnalysis((current) => !current)}
              type="button"
            >
              Needs analysis
            </button>
          </div>
          <div className="toolbar-stats">
            <span>{libraryStats.total} matches</span>
            <span>{libraryStats.withVideo} with video</span>
            <span>{pendingAnalyses} pending review</span>
          </div>
        </section>

        {Object.entries(groupedMatches).map(([groupLabel, groupMatches]) =>
          groupMatches.length === 0 ? null : (
            <section key={groupLabel} className="library-group">
              <div className="section-header">
                <h2>{groupLabel}</h2>
                <span>{groupMatches.length} matches</span>
              </div>
              <div className="match-grid">
                {groupMatches.map((match) => (
                  <button
                    key={match.matchId}
                    className={`match-card-shell ${selectedMatchId === match.matchId ? "active" : ""}`}
                    onClick={() => openMatch(match.matchId)}
                    type="button"
                  >
                    <div className="match-thumb-shell">
                      {match.thumbnailPath ? (
                        <img
                          alt={`${match.playerName ?? "Match"} thumbnail`}
                          src={toLocalFileSource(match.thumbnailPath)}
                        />
                      ) : (
                        <div className="match-thumb-fallback">
                          <Glyph name="camera" />
                          <span>No preview yet</span>
                        </div>
                      )}
                      <div className="match-badge-row">
                        <span className="match-badge">{match.bracket}</span>
                        <span className={`match-badge tone-${resultTone(match.resultForPlayer)}`}>
                          {match.resultForPlayer ?? "Pending"}
                        </span>
                        <span className="match-badge">{formatDuration(match.durationSeconds)}</span>
                      </div>
                    </div>
                    <div className="match-card-body">
                      <div className="match-card-topline">
                        <strong>{match.playerName ?? "Unknown player"}</strong>
                        <span>{formatDateLabel(match.startedAt)}</span>
                      </div>
                      <p className="muted-copy">
                        {[match.playerClassName, match.playerSpecLabel].filter(Boolean).join(" / ") || "Class/spec pending"}
                      </p>
                      <p className="muted-copy">{match.mapName}</p>
                      <div className="match-meta-row">
                        <span>{match.timelineMarkerCount} markers</span>
                        <span>{match.hasVideo ? "Video ready" : "No video"}</span>
                        <span>{match.hasManualAnalysis ? "Analysis ready" : "Awaiting analysis"}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ),
        )}

        {filteredMatches.length === 0 ? (
          <div className="empty-state-card">
            <Glyph name="review" />
            <strong>No matches in this view yet.</strong>
            <p>Import a combat log or sample pack to populate the library and start building the review archive.</p>
          </div>
        ) : null}
      </div>
    );
  }

  function renderSettingsScreen() {
    return (
      <div className="workspace-page narrow-page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h1>Desktop configuration</h1>
            <p className="page-copy">
              Storage, detection, recording, and app preferences stay inside the desktop workflow. Local OBS internals stay hidden unless you explicitly reveal them.
            </p>
          </div>
          <div className="page-actions">
            <button onClick={handleSaveSettings} disabled={isBusy} type="button">
              Save Changes
            </button>
            <button onClick={handleValidateSettings} disabled={isBusy} type="button">
              Validate Setup
            </button>
          </div>
        </header>

        <div className="tab-strip">
          {settingsTabs.map((tab) => (
            <button
              key={tab.key}
              className={`tab-button ${activeSettingsTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveSettingsTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section className="settings-panel">
          {activeSettingsTab === "storage" ? (
            <>
              <SettingsRow
                title="Recording Location"
                description="Final folder for arena recordings and replay assets."
                controls={
                  <div className="inline-field-group">
                    <input
                      value={settings.recordingDirectory ?? ""}
                      onChange={(event) => updateSetting("recordingDirectory", event.target.value)}
                    />
                    <button onClick={() => void chooseDirectoryFor("recordingDirectory", "Recording Location")} type="button">
                      Browse
                    </button>
                  </div>
                }
              />
              <SettingsRow
                title="Recording Cache Location"
                description="Working folder used while long recordings are being staged locally."
                controls={
                  <div className="inline-field-group">
                    <input
                      value={settings.recordingCacheDirectory ?? ""}
                      onChange={(event) => updateSetting("recordingCacheDirectory", event.target.value)}
                    />
                    <button onClick={() => void chooseDirectoryFor("recordingCacheDirectory", "Recording Cache Location")} type="button">
                      Browse
                    </button>
                  </div>
                }
              />
              <SettingsRow
                title="Maximum Disk Storage"
                description="Limit the local recording footprint before cleanup policies start mattering."
                controls={
                  <input
                    className="compact-input"
                    type="number"
                    value={settings.maxDiskStorageGb}
                    onChange={(event) => updateSetting("maxDiskStorageGb", Number(event.target.value) || 0)}
                  />
                }
              />
              <SettingsRow
                title="Maximum Match Files"
                description="Cap how many stored matches are kept before old sessions get pruned later."
                controls={
                  <input
                    className="compact-input"
                    type="number"
                    value={settings.maxMatchFiles}
                    onChange={(event) => updateSetting("maxMatchFiles", Number(event.target.value) || 0)}
                  />
                }
              />
            </>
          ) : null}

          {activeSettingsTab === "detection" ? (
            <>
              <SettingsRow
                title="WoW Installation"
                description="Primary local install used for addon deployment and log detection."
                controls={
                  <div className="inline-field-group">
                    <input
                      value={settings.wowRetailPath ?? ""}
                      onChange={(event) => updateSetting("wowRetailPath", event.target.value)}
                    />
                    <button onClick={() => void handleDetectWowPath()} type="button">
                      Detect
                    </button>
                  </div>
                }
              />
              <SettingsRow
                title="Combat Log Directory"
                description="Folder watched for chunks and manual imports during the MVP."
                controls={
                  <div className="inline-field-group">
                    <input
                      value={settings.combatLogDirectory ?? ""}
                      onChange={(event) => updateSetting("combatLogDirectory", event.target.value)}
                    />
                    <button onClick={() => void chooseDirectoryFor("combatLogDirectory", "Combat Log Directory")} type="button">
                      Browse
                    </button>
                  </div>
                }
              />
              <SettingsRow
                title="Arena Match Detection"
                description="Turn local match detection on or off without exposing backend internals."
                controls={
                  <label className="switch-pill">
                    <input
                      checked={settings.enableMatchDetection}
                      onChange={(event) => updateSetting("enableMatchDetection", event.target.checked)}
                      type="checkbox"
                    />
                    <span>{settings.enableMatchDetection ? "Active" : "Inactive"}</span>
                  </label>
                }
              />
              <SettingsRow
                title="Track Skirmish Matches"
                description="Keep skirmishes in the replay archive or leave them out of the review workflow."
                controls={
                  <label className="switch-pill">
                    <input
                      checked={settings.trackSkirmishMatches}
                      onChange={(event) => updateSetting("trackSkirmishMatches", event.target.checked)}
                      type="checkbox"
                    />
                    <span>{settings.trackSkirmishMatches ? "Enabled" : "Disabled"}</span>
                  </label>
                }
              />
              <SettingsRow
                title="Addon Status"
                description="Install or reinstall the addon used for safe combat log capture and arena metadata."
                controls={
                  <div className="inline-button-group">
                    <button onClick={handleInstallAddon} disabled={isBusy} type="button">
                      Install Addon
                    </button>
                    <button onClick={handleValidateSettings} disabled={isBusy} type="button">
                      Validate Setup
                    </button>
                  </div>
                }
              />
            </>
          ) : null}

          {activeSettingsTab === "application" ? (
            <>
              <SettingsRow
                title="Run at startup"
                description="Launch the desktop workspace automatically when the system session starts."
                controls={
                  <label className="switch-pill">
                    <input
                      checked={settings.runAtStartup}
                      onChange={(event) => updateSetting("runAtStartup", event.target.checked)}
                      type="checkbox"
                    />
                    <span>{settings.runAtStartup ? "On" : "Off"}</span>
                  </label>
                }
              />
              <SettingsRow
                title="Minimize to tray on close"
                description="Keep the tool ready in the background instead of fully exiting on close."
                controls={
                  <label className="switch-pill">
                    <input
                      checked={settings.minimizeToTrayOnClose}
                      onChange={(event) => updateSetting("minimizeToTrayOnClose", event.target.checked)}
                      type="checkbox"
                    />
                    <span>{settings.minimizeToTrayOnClose ? "On" : "Off"}</span>
                  </label>
                }
              />
              <SettingsRow
                title="Show MMR badge"
                description="Reserve space for rating context on library cards once all data sources are ready."
                controls={
                  <label className="switch-pill">
                    <input
                      checked={settings.showMmrBadge}
                      onChange={(event) => updateSetting("showMmrBadge", event.target.checked)}
                      type="checkbox"
                    />
                    <span>{settings.showMmrBadge ? "On" : "Off"}</span>
                  </label>
                }
              />
              <SettingsRow
                title="Show only my mistakes by default"
                description="Bias the review flow toward your own decision points before team-wide analysis."
                controls={
                  <label className="switch-pill">
                    <input
                      checked={settings.showOnlyMyMistakesByDefault}
                      onChange={(event) => updateSetting("showOnlyMyMistakesByDefault", event.target.checked)}
                      type="checkbox"
                    />
                    <span>{settings.showOnlyMyMistakesByDefault ? "On" : "Off"}</span>
                  </label>
                }
              />
              <SettingsRow
                title="Use list view for matches"
                description="Keep a denser archive layout available for high-volume replay sessions later."
                controls={
                  <label className="switch-pill">
                    <input
                      checked={settings.useListViewForMatches}
                      onChange={(event) => updateSetting("useListViewForMatches", event.target.checked)}
                      type="checkbox"
                    />
                    <span>{settings.useListViewForMatches ? "On" : "Off"}</span>
                  </label>
                }
              />
            </>
          ) : null}

          {activeSettingsTab === "recording" ? (
            <>
              <SettingsRow
                title="Recording Enabled"
                description="Master control for local match recording inside the desktop workflow."
                controls={
                  <label className="switch-pill">
                    <input
                      checked={settings.enableRecording}
                      onChange={(event) => updateSetting("enableRecording", event.target.checked)}
                      type="checkbox"
                    />
                    <span>{settings.enableRecording ? "Enabled" : "Disabled"}</span>
                  </label>
                }
              />
              <SettingsRow
                title="OBS Recording Integration"
                description="Use OBS as the recording engine without surfacing localhost and port details in normal settings."
                controls={
                  <label className="switch-pill">
                    <input
                      checked={settings.enableObsRecording}
                      onChange={(event) => updateSetting("enableObsRecording", event.target.checked)}
                      type="checkbox"
                    />
                    <span>{settings.enableObsRecording ? "Enabled" : "Disabled"}</span>
                  </label>
                }
              />
              <SettingsRow
                title="OBS Health"
                description="Check connection and test recording state from the product layer."
                controls={
                  <div className="inline-button-group">
                    <button onClick={handleTestObsConnection} disabled={isBusy} type="button">
                      Test Connection
                    </button>
                    <button onClick={handleStartObsRecording} disabled={isBusy} type="button">
                      Start Test Recording
                    </button>
                    <button onClick={handleStopObsRecording} disabled={isBusy} type="button">
                      Stop Test Recording
                    </button>
                  </div>
                }
              />
              <SettingsRow
                title="Review Utilities"
                description="Choose how video previews and clip workflows are processed after recording."
                controls={
                  <div className="inline-stat-group">
                    <span className="info-pill">Thumb {settings.videoThumbnailSecond}s</span>
                    <span className="info-pill">FFmpeg ready when configured</span>
                    <span className={`info-pill ${obsStatus?.isReachable ? "good" : ""}`}>
                      {obsStatus?.isReachable ? "OBS connected" : "OBS pending"}
                    </span>
                  </div>
                }
              />
            </>
          ) : null}

          {activeSettingsTab === "advanced" ? (
            <>
              <div className="advanced-toggle-row">
                <button onClick={() => setShowSensitiveValues((current) => !current)} type="button">
                  {showSensitiveValues ? "Hide Sensitive Values" : "Show Sensitive Values"}
                </button>
              </div>
              <SettingsRow
                title="OBS Endpoint"
                description="Internal local endpoint used by the desktop workflow."
                controls={
                  <input
                    className="mono-input"
                    readOnly
                    value={
                      showSensitiveValues
                        ? `${settings.obsHost}:${settings.obsPort}`
                        : "Configured locally"
                    }
                  />
                }
              />
              <SettingsRow
                title="OBS Password"
                description="Masked by default and only revealed explicitly."
                controls={
                  <input
                    className="mono-input"
                    readOnly
                    value={
                      showSensitiveValues
                        ? settings.obsPassword ?? ""
                        : settings.obsPassword
                          ? "••••••••"
                          : "Not configured"
                    }
                  />
                }
              />
              <SettingsRow
                title="FFmpeg Executable"
                description="Video utility path used for metadata, thumbnails, and clip generation."
                controls={
                  <input
                    value={showSensitiveValues ? settings.ffmpegExecutablePath ?? "" : "Configured in desktop backend"}
                    onChange={(event) => updateSetting("ffmpegExecutablePath", event.target.value || null)}
                    readOnly={!showSensitiveValues}
                    className="mono-input"
                  />
                }
              />
              <SettingsRow
                title="FFprobe Executable"
                description="Local media inspection utility path."
                controls={
                  <input
                    value={showSensitiveValues ? settings.ffprobeExecutablePath ?? "" : "Configured in desktop backend"}
                    onChange={(event) => updateSetting("ffprobeExecutablePath", event.target.value || null)}
                    readOnly={!showSensitiveValues}
                    className="mono-input"
                  />
                }
              />
            </>
          ) : null}
        </section>

        {validation ? (
          <div className={`validation-shell ${validation.isValid ? "valid" : "invalid"}`}>
            <strong>{validation.isValid ? "Setup healthy" : "Setup needs attention"}</strong>
            <ul>
              {validation.messages.length === 0 ? (
                <li>Everything looks ready for local review.</li>
              ) : (
                validation.messages.map((message) => <li key={message}>{message}</li>)
              )}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  function renderSceneScreen() {
    const previewSource = selectedMatch?.match.videoLocalPath ?? selectedMatch?.match.thumbnailPath ?? null;

    return (
      <div className="workspace-page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Scene</p>
            <h1>Capture source control</h1>
            <p className="page-copy">
              Pick which WoW session this desktop workflow should prefer, then tune capture source, video quality, and audio preferences without exposing low-level OBS network details.
            </p>
          </div>
          <div className="page-actions">
            <button onClick={handleStartObsRecording} disabled={isBusy} type="button">
              Start Recording
            </button>
            <button onClick={handleStopObsRecording} disabled={isBusy} type="button">
              Stop Recording
            </button>
          </div>
        </header>

        <section className="scene-preview-card">
          <div className="scene-preview-frame">
            {previewSource ? (
              selectedMatch?.match.videoLocalPath ? (
                <video
                  className="scene-video"
                  controls
                  src={toLocalFileSource(selectedMatch.match.videoLocalPath)}
                />
              ) : (
                <img
                  alt="Scene preview"
                  className="scene-image"
                  src={toLocalFileSource(previewSource)}
                />
              )
            ) : (
              <div className="scene-empty">
                <Glyph name="scene" />
                <strong>No current source preview yet.</strong>
                <p>Attach a local video or process a recorded match to use this area as the desktop capture preview surface.</p>
              </div>
            )}
          </div>

          <div className="tab-strip scene-tabs">
            {sceneTabs.map((tab) => (
              <button
                key={tab.key}
                className={`tab-button ${activeSceneTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveSceneTab(tab.key)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeSceneTab === "source" ? (
            <div className="scene-options-grid">
              <div className="scene-source-list">
                {sceneSources.map((source) => (
                  <button
                    key={source.key}
                    className={`source-card ${sceneTarget === source.key ? "active" : ""}`}
                    onClick={() => setSceneTarget(source.key)}
                    type="button"
                  >
                    <strong>{source.title}</strong>
                    <span>{source.description}</span>
                  </button>
                ))}
              </div>
              <div className="scene-option-card">
                <strong>Capture mode</strong>
                <div className="segmented-row">
                  {(["game", "window", "monitor"] as CaptureMode[]).map((mode) => (
                    <button
                      key={mode}
                      className={captureMode === mode ? "active" : ""}
                      onClick={() => setCaptureMode(mode)}
                      type="button"
                    >
                      {titleize(mode)}
                    </button>
                  ))}
                </div>
                <label className="switch-pill">
                  <input
                    checked={captureCursor}
                    onChange={(event) => setCaptureCursor(event.target.checked)}
                    type="checkbox"
                  />
                  <span>{captureCursor ? "Capture cursor" : "Hide cursor"}</span>
                </label>
              </div>
            </div>
          ) : null}

          {activeSceneTab === "video" ? (
            <div className="scene-form-grid">
              <SettingsRow
                title="Frame Rate"
                description="Keep the recording surface aligned with arena readability."
                controls={<div className="info-pill">60 FPS preferred</div>}
              />
              <SettingsRow
                title="Resolution"
                description="Target a clear replay feed without bloating local storage."
                controls={<div className="info-pill">1080p desktop target</div>}
              />
              <SettingsRow
                title="Quality"
                description="Preserve spell clarity and UI legibility during post-match review."
                controls={<div className="info-pill">High quality local replay</div>}
              />
            </div>
          ) : null}

          {activeSceneTab === "audio" ? (
            <div className="scene-form-grid">
              <SettingsRow
                title="Desktop Audio"
                description="Keep arena sound cues available in local playback."
                controls={<div className="info-pill">Enabled in recording workflow</div>}
              />
              <SettingsRow
                title="Microphone"
                description="Reserve local mic capture for future clip and coaching commentary workflows."
                controls={<div className="info-pill">Future configurable source</div>}
              />
              <SettingsRow
                title="Noise handling"
                description="Audio cleanup remains part of the future recording refinement path."
                controls={<div className="info-pill">Suppression later</div>}
              />
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  function renderReviewScreen() {
    if (!selectedMatch) {
      return (
        <div className="workspace-page">
          <div className="empty-state-card tall-empty">
            <Glyph name="review" />
            <strong>Select a match from the library.</strong>
            <p>Open any bracket view in the sidebar and launch a replay from the match grid to enter the review workstation.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="workspace-page">
        <header className="page-header review-header">
          <div>
            <p className="eyebrow">Review workstation</p>
            <h1>
              {selectedMatch.match.playerName ?? "Unknown player"} / {selectedMatch.match.playerClassName ?? "Unknown class"}
              {selectedMatch.match.playerSpecLabel ? ` / ${selectedMatch.match.playerSpecLabel}` : ""}
            </h1>
            <p className="page-copy">
              {selectedMatch.match.bracket} / {selectedMatch.match.mapName} / {formatDuration(selectedMatch.match.durationSeconds)}
            </p>
          </div>
          <div className="page-actions">
            <button onClick={handleAttachVideo} disabled={isBusy} type="button">
              Attach Video
            </button>
            <button onClick={handleProcessVideo} disabled={isBusy || !selectedMatch.match.videoLocalPath} type="button">
              Process Video
            </button>
            <button onClick={handleGenerateReviewClips} disabled={isBusy || !selectedMatch.match.videoLocalPath} type="button">
              Generate Clips
            </button>
          </div>
        </header>

        <section className="review-workspace-grid">
          <div className="review-media-column">
            <section className="review-video-card">
              {selectedMatch.match.videoLocalPath ? (
                <video
                  className="review-video"
                  controls
                  src={toLocalFileSource(selectedMatch.match.videoLocalPath)}
                />
              ) : selectedMatch.match.thumbnailPath ? (
                <img
                  alt="Match thumbnail"
                  className="review-video-image"
                  src={toLocalFileSource(selectedMatch.match.thumbnailPath)}
                />
              ) : (
                <div className="video-placeholder">
                  <Glyph name="camera" />
                  <strong>No local video linked yet.</strong>
                  <span>Link a local recording and this workstation turns into the main replay review surface.</span>
                </div>
              )}
            </section>
            <TimelineMarkerRail
              durationSeconds={selectedMatch.match.durationSeconds}
              markers={selectedMatch.timelineMarkers}
            />
          </div>

          <aside className="review-summary-column">
            <article className="summary-card">
              <div className="summary-card-topline">
                <strong>Match status</strong>
                <span className={`tone-chip tone-${resultTone(selectedMatch.match.resultForPlayer)}`}>
                  {selectedMatch.match.resultForPlayer ?? "Pending"}
                </span>
              </div>
              <div className="summary-list">
                <span>{selectedMatch.timelineMarkers.length} timeline markers</span>
                <span>{selectedMatch.insights.length} structured insights</span>
                <span>{selectedMatch.validationTargets.length} validation targets</span>
                <span>{selectedMatch.videoClips.length} generated clips</span>
              </div>
            </article>

            <article className="summary-card">
              <div className="summary-card-topline">
                <strong>Spec snapshot</strong>
                <span className="tone-chip tone-stone">
                  {selectedMatch.specPerformanceSnapshot?.specLabel ?? "Inferred profile"}
                </span>
              </div>
              <SnapshotRail snapshot={selectedMatch.specPerformanceSnapshot} />
            </article>

            {selectedMatch.metricSummary ? (
              <article className="summary-card">
                <div className="summary-card-topline">
                  <strong>Match metrics</strong>
                  <span className="tone-chip tone-stone">Details++ seed</span>
                </div>
                <div className="metric-mini-grid">
                  <article className="mini-stat-card">
                    <span>Total casts</span>
                    <strong>{formatLargeNumber(selectedMatch.metricSummary.totalCasts)}</strong>
                  </article>
                  <article className="mini-stat-card">
                    <span>DPS</span>
                    <strong>{selectedMatch.metricSummary.damagePerSecond}</strong>
                  </article>
                  <article className="mini-stat-card">
                    <span>HPS</span>
                    <strong>{selectedMatch.metricSummary.healingPerSecond}</strong>
                  </article>
                  <article className="mini-stat-card">
                    <span>Casts/min</span>
                    <strong>{selectedMatch.metricSummary.castsPerMinute}</strong>
                  </article>
                </div>
              </article>
            ) : null}
          </aside>
        </section>

        <div className="tab-strip review-tabs">
          {reviewTabs.map((tab) => (
            <button
              key={tab.key}
              className={`tab-button ${activeReviewTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveReviewTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeReviewTab === "overview" ? (
          <div className="content-grid two-column">
            <div className="stack-card">
              <div className="section-header">
                <h2>Structured insights</h2>
                <span>{selectedMatch.insights.length}</span>
              </div>
              <div className="intel-grid two-up">
                {selectedMatch.insights.length === 0 ? (
                  <p className="muted-copy">No imported insights yet.</p>
                ) : (
                  selectedMatch.insights.map((insight) => (
                    <article
                      key={`${insight.source}-${insight.videoSecond}-${insight.title}`}
                      className="intel-card"
                    >
                      <div className="intel-card-topline">
                        <strong>{insight.title}</strong>
                        <span className={`tone-chip tone-${categoryTone(insight.category)}`}>
                          {titleize(insight.category)}
                        </span>
                      </div>
                      <p>{insight.summary}</p>
                      {insight.recommendation ? <p className="muted-copy">{insight.recommendation}</p> : null}
                    </article>
                  ))
                )}
              </div>
            </div>
            <div className="stack-card">
              <div className="section-header">
                <h2>Validation targets</h2>
                <span>{selectedMatch.validationTargets.length}</span>
              </div>
              <div className="intel-grid two-up">
                {selectedMatch.validationTargets.length === 0 ? (
                  <p className="muted-copy">No validation targets imported yet.</p>
                ) : (
                  selectedMatch.validationTargets.map((target) => (
                    <article
                      key={`${target.source}-${target.videoSecond}-${target.metric}`}
                      className="intel-card"
                    >
                      <div className="intel-card-topline">
                        <strong>{target.metric}</strong>
                        <span className={`tone-chip tone-${categoryTone(target.category)}`}>
                          {titleize(target.category)}
                        </span>
                      </div>
                      <p>
                        {target.currentValue ?? "unknown"} {"->"} {target.expectedValue ?? "target"}
                        {target.unit ? ` (${target.unit})` : ""}
                      </p>
                      {target.note ? <p className="muted-copy">{target.note}</p> : null}
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeReviewTab === "details" ? (
          <div className="stack-card">
            <div className="section-header">
              <h2>Spell intelligence</h2>
              <span>{categorizedSpells.length} tracked spells</span>
            </div>
            <div className="intel-grid three-up">
              {categorizedSpells.length === 0 ? (
                <p className="muted-copy">No spell metrics persisted yet.</p>
              ) : (
                categorizedSpells.map((metric) => (
                  <SpellMetricCard key={`${metric.normalizedSpellName}-${metric.specLabel ?? "unknown"}`} metric={metric} />
                ))
              )}
            </div>
          </div>
        ) : null}

        {activeReviewTab === "coach" ? (
          <div className="content-grid two-column">
            <div className="stack-card">
              <div className="section-header">
                <h2>Local rule coach</h2>
                <span>{selectedMatch.ruleCoachFindings.length}</span>
              </div>
              <div className="intel-grid two-up">
                {selectedMatch.ruleCoachFindings.length === 0 ? (
                  <p className="muted-copy">No local rule coach findings yet.</p>
                ) : (
                  selectedMatch.ruleCoachFindings.map((item) => (
                    <RuleCoachFindingCard
                      key={`${item.scope}-${item.relatedMetric ?? item.title}-${item.title}`}
                      item={item}
                    />
                  ))
                )}
              </div>
            </div>
            <div className="stack-card">
              <div className="section-header">
                <h2>Benchmark audit</h2>
                <span>{selectedMatch.benchmarkComparisons.length}</span>
              </div>
              <div className="intel-grid two-up">
                {selectedMatch.benchmarkComparisons.length === 0 ? (
                  <p className="muted-copy">No benchmark comparisons yet.</p>
                ) : (
                  selectedMatch.benchmarkComparisons.map((item) => (
                    <BenchmarkComparisonCard
                      key={`${item.scope}-${item.metric}-${item.category}`}
                      item={item}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeReviewTab === "learning" ? (
          <div className="content-grid two-column">
            <div className="stack-card">
              <div className="section-header">
                <h2>Coach knowledge</h2>
                <span>{selectedMatch.coachKnowledgeParameters.length}</span>
              </div>
              <div className="intel-grid two-up">
                {selectedMatch.coachKnowledgeParameters.length === 0 ? (
                  <p className="muted-copy">No accumulated knowledge parameters yet.</p>
                ) : (
                  selectedMatch.coachKnowledgeParameters.map((item) => (
                    <KnowledgeCard
                      key={`${item.scope}-${item.className ?? "none"}-${item.specLabel ?? "none"}-${item.metric}`}
                      item={item}
                    />
                  ))
                )}
              </div>
            </div>
            <div className="stack-card">
              <div className="section-header">
                <h2>Coach skills</h2>
                <span>{selectedMatch.coachSkills.length}</span>
              </div>
              <div className="intel-grid two-up">
                {selectedMatch.coachSkills.length === 0 ? (
                  <p className="muted-copy">No accumulated coach skills yet.</p>
                ) : (
                  selectedMatch.coachSkills.map((item) => (
                    <SkillCard
                      key={`${item.scope}-${item.className ?? "none"}-${item.specLabel ?? "none"}-${item.area}-${item.goal}`}
                      item={item}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeReviewTab === "chatgpt" ? (
          <div className="content-grid two-column">
            <label className="editor-card">
              <span>Manual ChatGPT Prompt</span>
              <textarea readOnly value={promptText} />
            </label>
            <label className="editor-card">
              <span>Paste ChatGPT Response</span>
              <textarea
                value={manualResponseText}
                onChange={(event) => setManualResponseText(event.target.value)}
              />
            </label>
            <div className="action-card full-span">
              <div className="page-actions">
                <button onClick={handleExportPrompt} disabled={isBusy} type="button">
                  Export Prompt for ChatGPT
                </button>
                <button
                  onClick={handleImportManualAnalysis}
                  disabled={isBusy || !manualResponseText.trim()}
                  type="button"
                >
                  Import ChatGPT Response
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeReviewTab === "json" ? (
          <label className="editor-card full-height-card">
            <span>Match JSON</span>
            <textarea readOnly value={selectedMatch.matchJson} />
          </label>
        ) : null}
      </div>
    );
  }

  function renderClipsScreen() {
    return (
      <div className="workspace-page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Clips</p>
            <h1>Generated replay clips</h1>
            <p className="page-copy">
              Quick access to generated review cuts from local timeline markers, imported insights, and validation targets.
            </p>
          </div>
          <div className="page-actions">
            <button onClick={handleGenerateReviewClips} disabled={isBusy || !selectedMatchId} type="button">
              Generate from selected match
            </button>
          </div>
        </header>
        <div className="clip-grid">
          {selectedMatch?.videoClips.length ? (
            selectedMatch.videoClips.map((clip) => (
              <article key={`${clip.source}-${clip.videoSecond}-${clip.label}`} className="clip-card">
                <strong>{clip.label}</strong>
                <p>
                  {formatDuration(clip.startSecond)} to {formatDuration(clip.endSecond)} / {clip.category}
                </p>
                <video controls className="clip-player" src={toLocalFileSource(clip.clipPath)} />
              </article>
            ))
          ) : (
            <div className="empty-state-card">
              <Glyph name="clips" />
              <strong>No clips generated yet.</strong>
              <p>Process a selected match video and generate clips from markers, insights, and validation targets.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderVerifyScreen() {
    return (
      <div className="workspace-page narrow-page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Verify Setup</p>
            <h1>Local diagnostics</h1>
            <p className="page-copy">
              Keep WoW detection, addon health, backend readiness, and OBS connectivity in one operational panel.
            </p>
          </div>
          <div className="page-actions">
            <button onClick={handleValidateSettings} disabled={isBusy} type="button">
              Validate
            </button>
            <button onClick={handleTestObsConnection} disabled={isBusy} type="button">
              Test OBS
            </button>
          </div>
        </header>
        <div className="verification-grid">
          <article className="summary-card">
            <div className="summary-card-topline">
              <strong>Backend</strong>
              <span className="tone-chip tone-success">Online</span>
            </div>
            <p>{systemStatus?.status ?? "Waiting for backend"}</p>
          </article>
          <article className="summary-card">
            <div className="summary-card-topline">
              <strong>WoW detection</strong>
              <span className={`tone-chip tone-${settings.wowRetailPath ? "success" : "warning"}`}>
                {settings.wowRetailPath ? "Detected" : "Missing"}
              </span>
            </div>
            <p>{settings.wowRetailPath ?? "No WoW install configured yet."}</p>
          </article>
          <article className="summary-card">
            <div className="summary-card-topline">
              <strong>OBS</strong>
              <span className={`tone-chip tone-${obsStatus?.isReachable ? "success" : "warning"}`}>
                {obsStatus?.isReachable ? "Connected" : "Pending"}
              </span>
            </div>
            <p>{obsStatus?.errorMessage ?? obsStatus?.outputPath ?? "Connection test pending."}</p>
          </article>
        </div>
        {validation ? (
          <div className={`validation-shell ${validation.isValid ? "valid" : "invalid"}`}>
            <strong>{validation.isValid ? "Setup healthy" : "Setup needs attention"}</strong>
            <ul>
              {validation.messages.length === 0 ? (
                <li>Everything looks ready for local review.</li>
              ) : (
                validation.messages.map((message) => <li key={message}>{message}</li>)
              )}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  function renderContent() {
    if (isLibraryView(activeView)) {
      return renderLibraryScreen();
    }

    switch (activeView) {
      case "review":
        return renderReviewScreen();
      case "clips":
        return renderClipsScreen();
      case "settings":
        return renderSettingsScreen();
      case "scene":
        return renderSceneScreen();
      case "verify":
        return renderVerifyScreen();
      default:
        return renderLibraryScreen();
    }
  }

  return (
    <main className="desktop-shell">
      <aside className="desktop-sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">AG</div>
          <div>
            <strong>ArenaGodEyes</strong>
            <span>Desktop Coach</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {librarySidebarItems.map((item) => (
            <button
              key={item.key}
              className={`sidebar-item ${activeView === item.key ? "active" : ""}`}
              onClick={() => handleSidebarNavigation(item.key)}
              type="button"
            >
              <Glyph name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-divider" />

        <nav className="sidebar-nav secondary">
          {systemSidebarItems.map((item) => (
            <button
              key={item.key}
              className={`sidebar-item ${
                activeView === item.key ||
                (activeView === "review" &&
                  ((item.key === "details" && activeReviewTab === "details") ||
                    (item.key === "coach" && activeReviewTab === "coach") ||
                    (item.key === "learning" && activeReviewTab === "learning")))
                  ? "active"
                  : ""
              }`}
              onClick={() => handleSidebarNavigation(item.key)}
              type="button"
            >
              <Glyph name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>{systemStatus?.version ?? "v0.0.0"}</span>
          <span>{obsStatus?.isReachable ? "OBS connected" : "OBS pending"}</span>
        </div>
      </aside>

      <section className="desktop-main">
        <header className="desktop-topbar">
          <div className="topbar-status-cluster">
            <span className="topbar-pill">
              <i className={`status-dot ${isBusy ? "busy" : "ready"}`} />
              {isBusy ? "Processing" : systemStatus?.status ?? "Ready"}
            </span>
            <span className="topbar-pill">
              <i className={`status-dot ${settings.enableMatchDetection ? "ready" : "idle"}`} />
              {settings.enableMatchDetection ? "Detection active" : "Detection paused"}
            </span>
            <span className="topbar-pill">
              <i className={`status-dot ${obsStatus?.isRecording ? "recording" : "idle"}`} />
              {obsStatus?.isRecording ? "Recording" : "Recorder idle"}
            </span>
            <span className="topbar-pill">
              <i className={`status-dot ${settings.wowRetailPath ? "ready" : "idle"}`} />
              {settings.wowRetailPath ? "WoW detected" : "WoW not configured"}
            </span>
          </div>
          <div className="topbar-meta">
            <span>{pendingAnalyses} pending analyses</span>
            <span>{statusMessage}</span>
          </div>
        </header>

        <div className="desktop-content">{renderContent()}</div>
      </section>
    </main>
  );
}
