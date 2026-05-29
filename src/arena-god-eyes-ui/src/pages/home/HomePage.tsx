import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { TimelineMarkerRail } from "../../shared/components/TimelineMarkerRail";
import { api } from "../../shared/lib/api";
import type {
  AppSettings,
  CoachKnowledgeParameterItem,
  CoachSkillItem,
  FirstRunBootstrapStatus,
  LiveArenaSessionStatus,
  MatchBenchmarkComparisonItem,
  MatchLibraryItem,
  MatchParticipantReviewItem,
  MatchParticipantSummaryItem,
  MatchReviewDetails,
  MatchSpellMetricItem,
  ObsConnectionStatus,
  ObsSceneSetupResult,
  RuleCoachFindingItem,
  SettingsValidationResult,
  SpecPerformanceSnapshotItem,
  StorageOverview,
  SystemStatus,
} from "../../shared/types/api";
import "../../shared/styles/home-page.css";
import "../../shared/types/desktop";
import type { DesktopCaptureSource, DesktopObsLaunchStatus, DesktopWowWindow } from "../../shared/types/desktop";

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
  | "favourites"
  | "clips"
  | "diagnostics"
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
  | "favourites"
  | "clips"
  | "diagnostics"
  | "settings"
  | "scene"
  | "verify"
  | "review";

type SettingsTab =
  | "storage"
  | "detection"
  | "application"
  | "recording"
  | "obs"
  | "video"
  | "audio"
  | "advanced";
type SceneTab = "source" | "video" | "audio";
type ReviewTab = "overview" | "video" | "timeline" | "details" | "coach" | "chatgpt" | "export" | "raw" | "json";
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
  { key: "favourites", label: "Favourites", icon: "favourites" },
];

const systemSidebarItems: SidebarItem[] = [
  { key: "clips", label: "Clips", icon: "clips" },
  { key: "settings", label: "Settings", icon: "settings" },
  { key: "scene", label: "Scene", icon: "scene" },
  { key: "diagnostics", label: "Export Logs / Diagnostics", icon: "diagnostics" },
  { key: "verify", label: "Verify Setup", icon: "verify" },
];

const settingsTabs: Array<{ key: SettingsTab; label: string }> = [
  { key: "storage", label: "Storage" },
  { key: "detection", label: "Detection" },
  { key: "application", label: "Application" },
  { key: "recording", label: "Recording" },
  { key: "obs", label: "OBS" },
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
  { key: "advanced", label: "Advanced" },
];

const sceneTabs: Array<{ key: SceneTab; label: string }> = [
  { key: "source", label: "Source" },
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
];

const reviewTabs: Array<{ key: ReviewTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "video", label: "Video" },
  { key: "timeline", label: "Timeline" },
  { key: "details", label: "Details++" },
  { key: "coach", label: "Coach" },
  { key: "chatgpt", label: "ChatGPT" },
  { key: "export", label: "Export / Import" },
  { key: "raw", label: "Raw Events" },
  { key: "json", label: "JSON" },
];

const favoriteStorageKey = "arena-god-eyes:favourite-matches";

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

function formatDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatStorageGigabytes(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)} GB`;
}

function formatStorageUsedLine(overview: StorageOverview | null, fallbackLimitGb: number) {
  if (!overview) {
    return `Used 0 GB / ${fallbackLimitGb || 0} GB`;
  }

  const used = formatStorageGigabytes(overview.totalGigabytes);
  const limit = overview.maxDiskStorageGb > 0 ? `${overview.maxDiskStorageGb} GB` : "Unlimited";
  return `Used ${used} / ${limit}`;
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

function getPreferredRecorderMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function initials(input: string | null | undefined) {
  if (!input) {
    return "AG";
  }

  return input
    .split(/[\s/-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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

function participantLabel(participant: { className: string | null; specLabel: string | null; name: string }) {
  return participant.specLabel ?? participant.className ?? participant.name;
}

function participantTone(participant: { isTrackedPlayer: boolean; teamId: number }, trackedTeamId: number | null) {
  if (participant.isTrackedPlayer) {
    return "tracked";
  }

  if (trackedTeamId === null) {
    return "neutral";
  }

  return participant.teamId === trackedTeamId ? "ally" : "enemy";
}

function resolveTrackedTeamId(
  participants: Array<{ teamId: number; isTrackedPlayer: boolean }>,
) {
  return participants.find((item) => item.isTrackedPlayer)?.teamId ?? null;
}

function buildParticipantGroups<T extends { teamId: number; isTrackedPlayer: boolean }>(
  participants: T[],
) {
  const trackedTeamId = resolveTrackedTeamId(participants);
  const allies = participants.filter((item) => item.teamId === trackedTeamId);
  const enemies = trackedTeamId === null
    ? participants.filter((item) => !item.isTrackedPlayer)
    : participants.filter((item) => item.teamId !== trackedTeamId);

  return { trackedTeamId, allies, enemies };
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
  return (
    view === "all" ||
    view === "shuffle" ||
    view === "3v3" ||
    view === "2v2" ||
    view === "skirmish" ||
    view === "favourites"
  );
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
    favourites: (
      <>
        <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.8 7.2 19l.9-5.4-3.9-3.8 5.4-.8z" />
      </>
    ),
    clips: (
      <>
        <rect x="4" y="6" width="14" height="12" rx="2" />
        <path d="m18 10 3-2v8l-3-2" />
      </>
    ),
    diagnostics: (
      <>
        <path d="M4 12h6" />
        <path d="M14 7h6" />
        <path d="M14 17h6" />
        <circle cx="12" cy="12" r="2.5" />
        <circle cx="12" cy="12" r="7.5" />
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

function ParticipantBadge({
  participant,
  trackedTeamId,
  compact = false,
}: {
  participant: MatchParticipantSummaryItem | MatchParticipantReviewItem;
  trackedTeamId: number | null;
  compact?: boolean;
}) {
  const tone = participantTone(participant, trackedTeamId);

  return (
    <article className={`participant-badge participant-${tone} ${compact ? "compact" : ""}`}>
      <span className="participant-avatar">{initials(participantLabel(participant))}</span>
      <div className="participant-copy">
        <strong>{participant.name}</strong>
        <span>{participant.specLabel ?? participant.className ?? "Class pending"}</span>
      </div>
      {participant.isTrackedPlayer ? <span className="participant-tag">You</span> : null}
    </article>
  );
}

function MatchRosterStrip({ participants }: { participants: MatchParticipantSummaryItem[] }) {
  const { trackedTeamId, allies, enemies } = buildParticipantGroups(participants);

  return (
    <div className="match-roster-strip">
      <div className="match-roster-group">
        <span className="match-roster-label">Your Team</span>
        <div className="match-roster-icons">
          {allies.map((participant) => (
            <span
              key={`${participant.teamId}-${participant.name}`}
              className={`roster-spec-chip ${participant.isTrackedPlayer ? "tracked" : "ally"}`}
              title={`${participant.name} • ${participant.specLabel ?? participant.className ?? "Unknown"}`}
            >
              {initials(participantLabel(participant))}
            </span>
          ))}
        </div>
      </div>
      <span className="match-roster-versus">VS</span>
      <div className="match-roster-group enemy">
        <span className="match-roster-label">Enemy Team</span>
        <div className="match-roster-icons">
          {enemies.map((participant) => (
            <span
              key={`${participant.teamId}-${participant.name}`}
              className="roster-spec-chip enemy"
              title={`${participant.name} • ${participant.specLabel ?? participant.className ?? "Unknown"}`}
            >
              {initials(participantLabel(participant))}
            </span>
          ))}
        </div>
      </div>
      {trackedTeamId === null ? null : <span className="match-roster-count">{participants.length} players</span>}
    </div>
  );
}

function MatchRosterPanel({ participants }: { participants: MatchParticipantReviewItem[] }) {
  const { trackedTeamId, allies, enemies } = buildParticipantGroups(participants);

  return (
    <article className="summary-card roster-panel-card">
      <div className="summary-card-topline">
        <strong>Match roster</strong>
        <span className="tone-chip tone-stone">{participants.length} players</span>
      </div>
      <div className="roster-panel-grid">
        <div className="roster-column">
          <div className="roster-column-header">
            <strong>Your team</strong>
            <span>{allies.length}</span>
          </div>
          <div className="roster-column-list">
            {allies.map((participant) => (
              <ParticipantBadge
                key={participant.guid}
                participant={participant}
                trackedTeamId={trackedTeamId}
              />
            ))}
          </div>
        </div>
        <div className="roster-column">
          <div className="roster-column-header">
            <strong>Enemies</strong>
            <span>{enemies.length}</span>
          </div>
          <div className="roster-column-list">
            {enemies.map((participant) => (
              <ParticipantBadge
                key={participant.guid}
                participant={participant}
                trackedTeamId={trackedTeamId}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
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
  const [bootstrapStatus, setBootstrapStatus] = useState<FirstRunBootstrapStatus | null>(null);
  const [settings, setSettings] = useState<AppSettings>(emptySettings);
  const [storageOverview, setStorageOverview] = useState<StorageOverview | null>(null);
  const [validation, setValidation] = useState<SettingsValidationResult | null>(null);
  const [obsStatus, setObsStatus] = useState<ObsConnectionStatus | null>(null);
  const [matches, setMatches] = useState<MatchLibraryItem[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchReviewDetails | null>(null);
  const [manualResponseText, setManualResponseText] = useState("");
  const [promptText, setPromptText] = useState("");
  const [statusMessage, setStatusMessage] = useState("Workspace warming up.");
  const [isBusy, setIsBusy] = useState(false);
  const [favouriteMatchIds, setFavouriteMatchIds] = useState<string[]>(() => {
    try {
      const raw = globalThis.localStorage?.getItem(favoriteStorageKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [activeView, setActiveView] = useState<AppView>("all");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("storage");
  const [activeSceneTab, setActiveSceneTab] = useState<SceneTab>("source");
  const [activeReviewTab, setActiveReviewTab] = useState<ReviewTab>("overview");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [onlyWithVideo, setOnlyWithVideo] = useState(true);
  const [onlyNeedsAnalysis, setOnlyNeedsAnalysis] = useState(false);
  const [showSensitiveValues, setShowSensitiveValues] = useState(false);
  const [wowWindows, setWowWindows] = useState<DesktopWowWindow[]>([]);
  const [obsLaunchStatus, setObsLaunchStatus] = useState<DesktopObsLaunchStatus | null>(null);
  const [sceneSetupResult, setSceneSetupResult] = useState<ObsSceneSetupResult | null>(null);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("window");
  const [captureCursor, setCaptureCursor] = useState(true);
  const [sceneTarget, setSceneTarget] = useState<"wow-a" | "wow-b" | "auto">("auto");
  const [liveArenaSession, setLiveArenaSession] = useState<LiveArenaSessionStatus | null>(null);
  const [embeddedPreviewLabel, setEmbeddedPreviewLabel] = useState<string | null>(null);
  const [embeddedPreviewError, setEmbeddedPreviewError] = useState<string | null>(null);
  const [isEmbeddedRecording, setIsEmbeddedRecording] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const previewSourceRef = useRef<DesktopCaptureSource | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const autoRecordingArmedRef = useRef(false);
  const lastAttachedMatchIdRef = useRef<string | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!selectedMatchId) {
      return;
    }

    void loadMatch(selectedMatchId);
  }, [selectedMatchId]);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(favoriteStorageKey, JSON.stringify(favouriteMatchIds));
    } catch {
      // Ignore storage persistence failures in browser-restricted environments.
    }
  }, [favouriteMatchIds]);

  const runSceneAutomationRefresh = useEffectEvent(async () => {
    await refreshSceneAutomation();
  });

  const syncEmbeddedPreview = useEffectEvent(async () => {
    const selectedWindow = getSelectedWowWindow();
    if (!selectedWindow) {
      stopEmbeddedPreview();
      return;
    }

    await ensureEmbeddedPreview(selectedWindow);
  });

  const pollLiveArenaSession = useEffectEvent(async () => {
    const status = await api.getLiveArenaSession();
    setLiveArenaSession(status);

    if (status.isActive && status.shouldTrack && settings.enableRecording) {
      if (!autoRecordingArmedRef.current) {
        await startEmbeddedRecording();
      }

      return;
    }

    if (
      !status.isActive &&
      autoRecordingArmedRef.current &&
      status.lastCompletedMatchId &&
      status.lastCompletedMatchId !== lastAttachedMatchIdRef.current
    ) {
      await finalizeEmbeddedRecording(status.lastCompletedMatchId, status.bracket);
    }
  });

  useEffect(() => {
    if (activeView !== "scene") {
      return;
    }

    void runSceneAutomationRefresh();
  }, [activeView]);

  useEffect(() => {
    if (activeView !== "scene") {
      return;
    }

    void syncEmbeddedPreview().catch((error) => {
      setEmbeddedPreviewError(error instanceof Error ? error.message : "Failed to start the embedded WoW preview.");
    });
  }, [activeView, sceneTarget, wowWindows]);

  useEffect(() => {
    if (!window.arenaGodEyesDesktop?.isDesktop) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        await pollLiveArenaSession();
      } catch (error) {
        if (!cancelled) {
          setEmbeddedPreviewError(error instanceof Error ? error.message : "Failed to poll live arena session state.");
        }
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [settings.enableRecording, settings.recordingDirectory, wowWindows, sceneTarget]);

  useEffect(() => {
    return () => {
      stopEmbeddedPreview();
    };
  }, []);

  useEffect(() => {
    if (!previewVideoRef.current || !previewStreamRef.current) {
      return;
    }

    previewVideoRef.current.srcObject = previewStreamRef.current;
    previewVideoRef.current.muted = true;
    previewVideoRef.current.playsInline = true;
    void previewVideoRef.current.play().catch(() => undefined);
  }, [embeddedPreviewLabel, activeView]);

  const pendingAnalyses = useMemo(
    () => matches.filter((match) => !match.hasManualAnalysis).length,
    [matches],
  );

  const libraryStats = useMemo(
    () => ({
      total: matches.length,
      analyzed: matches.filter((match) => match.hasManualAnalysis).length,
      withVideo: matches.filter((match) => match.hasVideo).length,
      favourites: matches.filter((match) => favouriteMatchIds.includes(match.matchId)).length,
    }),
    [favouriteMatchIds, matches],
  );

  const filteredMatches = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();

    return matches.filter((match) => {
      if (isLibraryView(activeView) && !matchesViewFilter(match, activeView)) {
        return false;
      }

      if (activeView === "favourites" && !favouriteMatchIds.includes(match.matchId)) {
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
  }, [activeView, favouriteMatchIds, libraryQuery, matches, onlyNeedsAnalysis, onlyWithVideo]);

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
    () => {
      const hasMultipleWowWindows = wowWindows.length > 1;

      return [
        {
          key: "wow-a" as const,
          title: hasMultipleWowWindows ? "WoW Session A" : "Detected WoW",
          description: wowWindows[0]?.title
            ? `${wowWindows[0].title} (${wowWindows[0].executableName ?? wowWindows[0].processName})`
            : settings.wowRetailPath
              ? "Primary configured client and preferred queue window."
              : "Primary client slot for your main WoW window.",
        },
        {
          key: "wow-b" as const,
          title: hasMultipleWowWindows ? "WoW Session B" : "Second WoW instance",
          description: wowWindows[1]?.title
            ? `${wowWindows[1].title} (${wowWindows[1].executableName ?? wowWindows[1].processName})`
            : "Only used when a second WoW client is open.",
        },
        {
          key: "auto" as const,
          title: "Auto active WoW",
          description: wowWindows[0]?.title
            ? `Use ${wowWindows[0].title} as the preferred automatic capture target.`
            : "Use the active session target when the app starts a recording workflow.",
        },
      ];
    },
    [settings.wowRetailPath, wowWindows],
  );

  function stopEmbeddedPreview() {
    previewStreamRef.current?.getTracks().forEach((track) => track.stop());
    previewStreamRef.current = null;
    previewSourceRef.current = null;
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
  }

  function getSelectedWowWindow() {
    if (wowWindows.length === 0) {
      return null;
    }

    if (wowWindows.length === 1) {
      return wowWindows[0];
    }

    if (sceneTarget === "wow-b") {
      return wowWindows[1] ?? wowWindows[0];
    }

    return wowWindows[0];
  }

  async function resolveCaptureSource(windowTarget?: DesktopWowWindow | null) {
    const desktopBridge = window.arenaGodEyesDesktop;
    if (!desktopBridge?.isDesktop) {
      return null;
    }

    const selectedWindow = windowTarget ?? getSelectedWowWindow();
    if (!selectedWindow) {
      return null;
    }

    const sources = await desktopBridge.listCaptureSources();
    const normalizedTitle = selectedWindow.title.trim().toLowerCase();
    const normalizedProcess = (selectedWindow.executableName ?? selectedWindow.processName).trim().toLowerCase();

    return (
      sources.find((source) => source.name.trim().toLowerCase() === normalizedTitle) ??
      sources.find((source) => source.name.trim().toLowerCase().includes(normalizedTitle)) ??
      sources.find((source) => normalizedTitle.includes(source.name.trim().toLowerCase())) ??
      sources.find((source) => source.name.trim().toLowerCase().includes(normalizedProcess)) ??
      null
    );
  }

  async function ensureEmbeddedPreview(windowTarget?: DesktopWowWindow | null) {
    const selectedWindow = windowTarget ?? getSelectedWowWindow();
    if (!selectedWindow) {
      stopEmbeddedPreview();
      setEmbeddedPreviewLabel(null);
      setEmbeddedPreviewError("WoW capture target not detected yet.");
      return null;
    }

    const source = await resolveCaptureSource(selectedWindow);
    if (!source) {
      stopEmbeddedPreview();
      setEmbeddedPreviewLabel(selectedWindow.title);
      setEmbeddedPreviewError("The app detected WoW, but Windows did not expose a matching desktop capture source yet.");
      return null;
    }

    if (previewSourceRef.current?.id === source.id && previewStreamRef.current) {
      setEmbeddedPreviewLabel(source.name);
      setEmbeddedPreviewError(null);
      return previewStreamRef.current;
    }

    stopEmbeddedPreview();

    const constraints = {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: source.id,
          minWidth: 1280,
          maxWidth: 2560,
          minHeight: 720,
          maxHeight: 1440,
          minFrameRate: 30,
          maxFrameRate: 60,
        },
      },
    } as MediaStreamConstraints;

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    previewStreamRef.current = stream;
    previewSourceRef.current = source;
    setEmbeddedPreviewLabel(source.name);
    setEmbeddedPreviewError(null);

    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = stream;
      previewVideoRef.current.muted = true;
      previewVideoRef.current.playsInline = true;
      void previewVideoRef.current.play().catch(() => undefined);
    }

    return stream;
  }

  async function finalizeEmbeddedRecording(matchId: string | null, bracket: string | null) {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      return;
    }

    const stopped = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "video/webm" });
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
        resolve(blob);
      };
    });

    recorder.stop();
    const blob = await stopped;
    setIsEmbeddedRecording(false);
    autoRecordingArmedRef.current = false;

    if (!settings.recordingDirectory) {
      setStatusMessage("Match finished, but there is no recording directory configured yet.");
      return;
    }

    const startedAtToken = liveArenaSession?.startedAt
      ? liveArenaSession.startedAt.replace(/[:.]/g, "-")
      : new Date().toISOString().replace(/[:.]/g, "-");
    const safeBracket = (bracket ?? "arena").replace(/[^a-z0-9_-]+/gi, "-");
    const resolvedMatchId = matchId?.trim() || `pending-${safeBracket}`;
    const fileName = `${resolvedMatchId}-${startedAtToken}.webm`;
    const arrayBuffer = await blob.arrayBuffer();
    const savedPath = await window.arenaGodEyesDesktop?.saveRecordingBuffer({
      directoryPath: settings.recordingDirectory,
      fileName,
      arrayBuffer,
    });

    if (!savedPath) {
      throw new Error("The desktop app could not persist the recorded arena video.");
    }

    if (!matchId) {
      setStatusMessage(`Arena video saved to ${savedPath}, but the match import did not finish in time to attach it automatically.`);
      return;
    }

    await api.attachVideo(matchId, savedPath);
    await refreshMatches(matchId);
    await loadMatch(matchId);
    lastAttachedMatchIdRef.current = matchId;
    setStatusMessage(`Arena video saved and attached to ${matchId}.`);
  }

  async function startEmbeddedRecording() {
    if (isEmbeddedRecording || mediaRecorderRef.current) {
      return;
    }

    const stream = await ensureEmbeddedPreview();
    if (!stream) {
      return;
    }

    recordedChunksRef.current = [];
    const mimeType = getPreferredRecorderMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    autoRecordingArmedRef.current = true;
    setIsEmbeddedRecording(true);
    setStatusMessage("Arena recorder armed. The desktop app is capturing the WoW window directly.");
  }

  async function loadDashboard() {
    setIsBusy(true);
    try {
      const [statusResult, bootstrapStatusResult, settingsResult, matchesResult, storageOverviewResult] = await Promise.all([
        api.getSystemStatus(),
        api.getBootstrapStatus(),
        api.getSettings(),
        api.listMatches(),
        api.getStorageOverview(),
      ]);

      setSystemStatus(statusResult);
      setBootstrapStatus(bootstrapStatusResult);
      setSettings(settingsResult);
      setMatches(matchesResult);
      setStorageOverview(storageOverviewResult);
      setSelectedMatchId((current) => current ?? matchesResult[0]?.matchId ?? null);
      const latestObsStatus = await api.getObsStatus();
      setObsStatus(latestObsStatus);
      setStatusMessage(
        bootstrapStatusResult.pendingActions.length > 0
          ? `Bootstrap pending: ${bootstrapStatusResult.pendingActions.join(", ")}.`
          : "Backend online. Ready for post-match review and coach learning.",
      );
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
      const updatedStorageOverview = await api.getStorageOverview();
      setSettings(updated);
      setStorageOverview(updatedStorageOverview);
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

  function handleApplyStorageDefaults() {
    setSettings((current) => ({
      ...current,
      recordingDirectory: storageOverview?.defaultRecordingDirectory ?? current.recordingDirectory,
      recordingCacheDirectory: storageOverview?.defaultRecordingCacheDirectory ?? current.recordingCacheDirectory,
      maxDiskStorageGb: current.maxDiskStorageGb || 100,
      maxMatchFiles: current.maxMatchFiles || 1000,
    }));
    setStatusMessage("Storage defaults prepared locally. Save settings to persist them.");
  }

  function handleResetStorageLimit() {
    updateSetting("maxDiskStorageGb", 100);
    setStatusMessage("Maximum disk storage reset to 100 GB.");
  }

  function handleResetMatchFiles() {
    updateSetting("maxMatchFiles", 1000);
    setStatusMessage("Maximum match files reset to 1000.");
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
      await startEmbeddedRecording();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to start the in-app recorder.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStopObsRecording() {
    setIsBusy(true);
    try {
      await finalizeEmbeddedRecording(selectedMatchId, selectedMatch?.match.bracket ?? null);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to stop the in-app recorder.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePrepareObsScene(windowOverride?: DesktopWowWindow | null) {
    const selectedWindow = windowOverride ?? getSelectedWowWindow();
    if (!selectedWindow) {
      setStatusMessage("No WoW window was detected for Scene automation.");
      return;
    }

    setIsBusy(true);
    try {
      const result = await api.ensureObsWowScene({
        windowTitle: selectedWindow.title,
        executableName: selectedWindow.executableName ?? selectedWindow.processName,
        windowClassName: selectedWindow.className,
        captureMode,
        captureCursor,
        sceneName: "ArenaGodEyes Scene",
        sourceName: "ArenaGodEyes WoW Capture",
      });

      setSceneSetupResult(result);
      const latestObsStatus = await api.getObsStatus();
      setObsStatus(latestObsStatus);
      setStatusMessage(
        result.sceneReady
          ? `OBS scene prepared for ${selectedWindow.title}.`
          : result.errorMessage ?? "OBS scene setup failed.",
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to prepare OBS scene.");
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshSceneAutomation() {
    try {
      const desktopBridge = window.arenaGodEyesDesktop;
      if (!desktopBridge?.isDesktop) {
        return;
      }

      const [obsLaunch, windows] = await Promise.all([
        desktopBridge.ensureObsRunning(),
        desktopBridge.listWowWindows(),
      ]);

      setObsLaunchStatus(obsLaunch);
      setWowWindows(windows);

      const latestObsStatus = await api.getObsStatus();
      setObsStatus(latestObsStatus);

      if (windows.length > 0) {
        const preferredWindow =
          sceneTarget === "wow-b"
            ? windows[1] ?? windows[0]
            : windows[0];
        await ensureEmbeddedPreview(preferredWindow);

        if (latestObsStatus.isReachable) {
          await handlePrepareObsScene(preferredWindow);
          return;
        }
      }

      if (windows.length === 0) {
        setStatusMessage("WoW is not visible yet. Open the character window before testing Scene detection.");
      } else if (!latestObsStatus.isReachable) {
        setStatusMessage("WoW preview is available in-app. OBS automation is still unavailable, so fallback recording is active.");
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to refresh Scene automation.");
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

  function toggleFavourite(matchId: string) {
    setFavouriteMatchIds((current) =>
      current.includes(matchId) ? current.filter((item) => item !== matchId) : [...current, matchId],
    );
  }

  async function handleCopyPrompt() {
    if (!promptText.trim()) {
      setStatusMessage("Export a prompt first before copying it.");
      return;
    }

    try {
      await navigator.clipboard.writeText(promptText);
      setStatusMessage("Prompt copied to clipboard.");
    } catch {
      setStatusMessage("Clipboard access failed. Export the prompt to file instead.");
    }
  }

  function openMatch(matchId: string, tab: ReviewTab = "overview") {
    setSelectedMatchId(matchId);
    setActiveView("review");
    setActiveReviewTab(tab);
  }

  function openContextualReviewTab(tab: ReviewTab, label: string) {
    if (selectedMatchId) {
      setActiveView("review");
      setActiveReviewTab(tab);
      return;
    }

    setActiveView("all");
    setStatusMessage(`Choose a replay first to open ${label}.`);
  }

  function handleSidebarNavigation(view: AppView) {
    setActiveView(view);
  }

  function renderLibraryScreen() {
    const activeLibraryLabel =
      librarySidebarItems.find((item) => item.key === activeView)?.label ?? "Match Library";
    const visibleGroupEntries = Object.entries(groupedMatches).filter(([, groupMatches]) => groupMatches.length > 0);

    return (
      <div className="workspace-page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Arena library</p>
            <h1>{activeLibraryLabel}</h1>
            <p className="page-copy">
              Browse recorded replays like an archive. Each card should represent one match video with the details workspace behind it.
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
              Recorded only
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
            <span>{libraryStats.withVideo} recorded replays</span>
            <span>{libraryStats.favourites} favourites</span>
            <span>{pendingAnalyses} pending review</span>
          </div>
        </section>

        {visibleGroupEntries.length === 0 ? (
          <div className="empty-state-card">
            <Glyph name="camera" />
            <strong>No recorded replays yet.</strong>
            <p>
              The main library is now focused on matches that already have a video. Finish one automatic recording or attach a local video to an imported match.
            </p>
          </div>
        ) : null}

        {visibleGroupEntries.map(([groupLabel, groupMatches]) =>
          groupMatches.length === 0 ? null : (
            <section key={groupLabel} className="library-group">
              <div className="section-header">
                <h2>{groupLabel}</h2>
                <span>{groupMatches.length} matches</span>
              </div>
              <div className="match-grid">
                {groupMatches.map((match) => (
                  <article
                    key={match.matchId}
                    className={`match-card-shell ${selectedMatchId === match.matchId ? "active" : ""}`}
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
                          <span>Replay video pending</span>
                        </div>
                      )}
                      <div className="match-badge-row">
                        <span className="match-badge">{match.bracket}</span>
                        <span className={`match-badge tone-${resultTone(match.resultForPlayer)}`}>
                          {match.resultForPlayer ?? "Pending"}
                        </span>
                        <span className="match-badge">{formatDuration(match.durationSeconds)}</span>
                      </div>
                      <div className="match-hover-panel">
                        <div className="match-hover-grid">
                          <span>Map</span>
                          <strong>{match.mapName}</strong>
                          <span>Replay</span>
                          <strong>{match.hasVideo ? "Video ready" : "No replay video yet"}</strong>
                          <span>Combat log</span>
                          <strong>{match.matchJsonPath ? "Imported" : "Missing"}</strong>
                          <span>Analysis</span>
                          <strong>{match.hasManualAnalysis ? "Imported" : "Pending"}</strong>
                          <span>Markers</span>
                          <strong>{match.timelineMarkerCount}</strong>
                          <span>Date</span>
                          <strong>{formatDateTimeLabel(match.startedAt)}</strong>
                        </div>
                        <div className="match-hover-actions">
                          <button onClick={() => openMatch(match.matchId)} type="button">
                            Open Review
                          </button>
                          <button onClick={() => openMatch(match.matchId, "details")} type="button">
                            Details++
                          </button>
                          <button onClick={() => toggleFavourite(match.matchId)} type="button">
                            {favouriteMatchIds.includes(match.matchId) ? "Unfavourite" : "Favourite"}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="match-card-body">
                      <div className="match-card-title-row">
                        <span className="spec-token">{initials(match.playerSpecLabel ?? match.playerClassName ?? match.playerName)}</span>
                        <div className="match-card-title-copy">
                          <div className="match-card-topline">
                            <strong>{match.playerName ?? "Unknown player"}</strong>
                            <span>{formatDateLabel(match.startedAt)}</span>
                          </div>
                          <p className="muted-copy">
                            {[match.playerClassName, match.playerSpecLabel].filter(Boolean).join(" / ") || "Class/spec pending"}
                          </p>
                        </div>
                      </div>
                      <p className="muted-copy">{match.mapName}</p>
                      {match.participants.length > 0 ? <MatchRosterStrip participants={match.participants} /> : null}
                      <div className="match-meta-row">
                        <span>{match.timelineMarkerCount} markers</span>
                        <span>{match.hasVideo ? "Video ready" : "No replay video"}</span>
                        <span>{match.matchJsonPath ? "JSON ready" : "No JSON"}</span>
                        <span>{match.hasManualAnalysis ? "Analysis ready" : "Awaiting analysis"}</span>
                      </div>
                      <div className="match-card-actions">
                        <button onClick={() => openMatch(match.matchId)} type="button">
                          Open
                        </button>
                        <button onClick={() => openMatch(match.matchId, "coach")} type="button">
                          Coach
                        </button>
                        <button onClick={() => toggleFavourite(match.matchId)} type="button">
                          {favouriteMatchIds.includes(match.matchId) ? "Saved" : "Save"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ),
        )}

        {filteredMatches.length === 0 ? (
          <div className="empty-state-card">
            <Glyph name="review" />
            <strong>No matches in this view yet.</strong>
            <p>
              {activeView === "favourites"
                ? "Favourite a replay from the library and it will stay pinned here."
                : "Import a combat log or sample pack to populate the library and start building the review archive."}
            </p>
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
              Storage, detection, recording, and app preferences stay clean in product language. Technical endpoints remain hidden until you explicitly reveal the advanced area.
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
                    <button onClick={handleApplyStorageDefaults} type="button">
                      Use Default
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
                    <button onClick={handleApplyStorageDefaults} type="button">
                      Use Default
                    </button>
                  </div>
                }
              />
              <SettingsRow
                title="Maximum Disk Storage"
                description="Limit the local recording footprint before cleanup policies start mattering."
                controls={
                  <div className="inline-field-group inline-compact-group">
                    <input
                      className="compact-input"
                      type="number"
                      value={settings.maxDiskStorageGb}
                      onChange={(event) => updateSetting("maxDiskStorageGb", Number(event.target.value) || 0)}
                    />
                    <button onClick={handleResetStorageLimit} type="button">
                      Reset
                    </button>
                  </div>
                }
              />
              <SettingsRow
                title="Current Disk Usage"
                description="Live footprint from recordings plus temporary staged capture files."
                controls={
                  <div className="storage-usage-card">
                    <div className="storage-usage-meta">
                      <strong>{formatStorageUsedLine(storageOverview, settings.maxDiskStorageGb)}</strong>
                      <span>
                        {storageOverview
                          ? `${storageOverview.recordingFileCount} recording files and ${storageOverview.cacheFileCount} cache files detected`
                          : "Usage information loads from the backend workspace."}
                      </span>
                    </div>
                    <div className="storage-usage-bar" aria-hidden="true">
                      <span
                        className="storage-usage-bar-fill"
                        style={{ width: `${storageOverview?.usagePercent ?? 0}%` }}
                      />
                    </div>
                  </div>
                }
              />
              <SettingsRow
                title="Maximum Match Files"
                description="Cap how many stored matches are kept before old sessions get pruned later."
                controls={
                  <div className="inline-field-group inline-compact-group">
                    <input
                      className="compact-input"
                      type="number"
                      value={settings.maxMatchFiles}
                      onChange={(event) => updateSetting("maxMatchFiles", Number(event.target.value) || 0)}
                    />
                    <button onClick={handleResetMatchFiles} type="button">
                      Reset
                    </button>
                  </div>
                }
              />
              <div className="settings-inline-note">
                <span>Default recordings folder: {storageOverview?.defaultRecordingDirectory ?? "Loading..."}</span>
                <span>Default cache folder: {storageOverview?.defaultRecordingCacheDirectory ?? "Loading..."}</span>
              </div>
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
                title="Recording Mode"
                description="Use OBS for the MVP recording workflow while keeping the UI product-facing."
                controls={
                  <div className="inline-stat-group">
                    <span className="info-pill">OBS WebSocket</span>
                    <span className="info-pill">Manual fallback later</span>
                  </div>
                }
              />
              <SettingsRow
                title="Auto Recording"
                description="Keep match recordings aligned with arena start and stop behavior."
                controls={
                  <div className="inline-stat-group">
                    <span className={`info-pill ${settings.enableRecording ? "good" : ""}`}>
                      {settings.enableRecording ? "Auto start ready" : "Recording disabled"}
                    </span>
                    <span className="info-pill">
                      {settings.trackSkirmishMatches ? "Skirmish capture on" : "Skirmish capture off"}
                    </span>
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

          {activeSettingsTab === "obs" ? (
            <>
              <SettingsRow
                title="OBS status"
                description="Normal product view for recorder health without showing host and port values."
                controls={
                  <div className="inline-stat-group">
                    <span className={`info-pill ${obsStatus?.isReachable ? "good" : ""}`}>
                      {obsStatus?.isReachable ? "OBS connected" : "OBS disconnected"}
                    </span>
                    <span className="info-pill">{settings.enableObsRecording ? "Recording enabled" : "Recording off"}</span>
                  </div>
                }
              />
              <SettingsRow
                title="Connection actions"
                description="Validate the recorder from the product layer."
                controls={
                  <div className="inline-button-group">
                    <button onClick={handleTestObsConnection} disabled={isBusy} type="button">
                      Test connection
                    </button>
                    <button onClick={handleStartObsRecording} disabled={isBusy} type="button">
                      Start test recording
                    </button>
                    <button onClick={handleStopObsRecording} disabled={isBusy} type="button">
                      Stop test recording
                    </button>
                  </div>
                }
              />
            </>
          ) : null}

          {activeSettingsTab === "video" ? (
            <>
              <SettingsRow
                title="Thumbnail Second"
                description="Frame position used when creating replay card previews."
                controls={
                  <input
                    className="compact-input"
                    type="number"
                    value={settings.videoThumbnailSecond}
                    onChange={(event) => updateSetting("videoThumbnailSecond", Number(event.target.value) || 0)}
                  />
                }
              />
              <SettingsRow
                title="Replay quality target"
                description="Keep spell readability and UI clarity strong during review."
                controls={
                  <div className="inline-stat-group">
                    <span className="info-pill">720p</span>
                    <span className="info-pill good">1080p</span>
                    <span className="info-pill">1440p</span>
                  </div>
                }
              />
            </>
          ) : null}

          {activeSettingsTab === "audio" ? (
            <>
              <SettingsRow
                title="Desktop audio"
                description="Keep arena sound cues in the local replay workflow."
                controls={<div className="info-pill good">Enabled for review</div>}
              />
              <SettingsRow
                title="Microphone"
                description="Reserve mic capture for commentary and future coaching clips."
                controls={<div className="info-pill">Future configurable source</div>}
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
                          ? "********"
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
    const selectedWowWindow = getSelectedWowWindow();
    const previewSource = selectedMatch?.match.videoLocalPath ?? selectedMatch?.match.thumbnailPath ?? null;
    const hasEmbeddedPreview = Boolean(previewStreamRef.current);

    return (
      <div className="workspace-page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Scene</p>
            <h1>Capture source control</h1>
            <p className="page-copy">
              Pick the active WoW target, configure source capture, and keep video and audio choices operational. This screen stays focused on recording, not coaching.
            </p>
          </div>
          <div className="page-actions">
            <button onClick={() => void refreshSceneAutomation()} disabled={isBusy} type="button">
              Refresh Scene
            </button>
            <button onClick={() => void handlePrepareObsScene()} disabled={isBusy || !selectedWowWindow} type="button">
              Prepare OBS Scene
            </button>
            <button onClick={handleStartObsRecording} disabled={isBusy} type="button">
              Start Recording
            </button>
            <button onClick={handleStopObsRecording} disabled={isBusy} type="button">
              Stop Recording
            </button>
          </div>
        </header>

        <section className="scene-preview-card">
          <div className={hasEmbeddedPreview || previewSource ? "scene-preview-frame" : "scene-detection-banner"}>
            {hasEmbeddedPreview ? (
              <video
                ref={previewVideoRef}
                autoPlay
                className="scene-video"
                muted
                playsInline
              />
            ) : previewSource ? (
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
              <div className="scene-empty compact">
                <Glyph name="scene" />
                <strong>{embeddedPreviewLabel ?? selectedWowWindow?.title ?? "WoW capture target not detected yet."}</strong>
                <p>
                  {embeddedPreviewError
                    ? embeddedPreviewError
                    : selectedWowWindow
                      ? `Detected ${selectedWowWindow.executableName ?? selectedWowWindow.processName}. The live embedded preview is preparing.`
                      : "Open a visible WoW window and the Scene tab will detect it here."}
                </p>
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
                <strong>Automation status</strong>
                <div className="scene-stack-list">
                  <span className={`info-pill ${wowWindows.length > 0 ? "good" : ""}`}>
                    {wowWindows.length > 0 ? `${wowWindows.length} WoW window(s) detected` : "WoW window not detected"}
                  </span>
                  <span className={`info-pill ${previewStreamRef.current ? "good" : ""}`}>
                    {previewStreamRef.current ? "Embedded preview live" : "Embedded preview pending"}
                  </span>
                  <span className={`info-pill ${obsLaunchStatus?.detected ? "good" : ""}`}>
                    {obsLaunchStatus?.detected ? "OBS process detected" : "OBS process pending"}
                  </span>
                  <span className={`info-pill ${obsStatus?.isReachable ? "good" : ""}`}>
                    {obsStatus?.isReachable ? "OBS connected" : "OBS not connected"}
                  </span>
                  <span className={`info-pill ${sceneSetupResult?.sceneReady ? "good" : ""}`}>
                    {sceneSetupResult?.sceneReady ? "Scene prepared" : "Scene not prepared"}
                  </span>
                </div>
                <strong>Capture mode</strong>
                <div className="segmented-row">
                  {(["game", "window", "monitor"] as CaptureMode[]).map((mode) => (
                    <button
                      key={mode}
                      className={captureMode === mode ? "active" : ""}
                      onClick={() => {
                        setCaptureMode(mode);
                      }}
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
                <div className="scene-stack-list">
                  <span className="info-pill">
                    Selected target: {selectedWowWindow?.title ?? (sceneTarget === "auto" ? "Auto" : titleize(sceneTarget))}
                  </span>
                  <span className={`info-pill ${settings.enableRecording ? "good" : ""}`}>
                    {settings.enableRecording ? "App recorder armed" : "Recording disabled"}
                  </span>
                  <span className={`info-pill ${isEmbeddedRecording ? "good" : ""}`}>
                    {isEmbeddedRecording ? "Recording in progress" : "Recorder idle"}
                  </span>
                  {selectedWowWindow ? (
                    <span className="info-pill good">
                      {selectedWowWindow.title} / {selectedWowWindow.className}
                    </span>
                  ) : null}
                  {sceneSetupResult?.matchedWindow ? (
                    <span className="info-pill good">OBS source: {sceneSetupResult.matchedWindow}</span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {activeSceneTab === "video" ? (
            <div className="scene-form-grid">
              <SettingsRow
                title="Frame Rate"
                description="Keep the recording surface aligned with arena readability."
                controls={
                  <div className="segmented-row compact-segmented">
                    <button className="active" type="button">
                      60 FPS
                    </button>
                    <button type="button">30 FPS</button>
                  </div>
                }
              />
              <SettingsRow
                title="Resolution"
                description="Target a clear replay feed without bloating local storage."
                controls={
                  <div className="inline-stat-group">
                    <span className="info-pill">720p</span>
                    <span className="info-pill good">1080p</span>
                    <span className="info-pill">1440p</span>
                  </div>
                }
              />
              <SettingsRow
                title="Quality"
                description="Preserve spell clarity and UI legibility during post-match review."
                controls={
                  <div className="inline-stat-group">
                    <span className="info-pill">Low</span>
                    <span className="info-pill">Medium</span>
                    <span className="info-pill good">High</span>
                  </div>
                }
              />
              <SettingsRow
                title="Encoder"
                description="Stay ready for local GPU-backed recording workflows."
                controls={
                  <div className="inline-stat-group">
                    <span className="info-pill good">NVIDIA NVENC</span>
                    <span className="info-pill">AMD</span>
                    <span className="info-pill">Intel</span>
                    <span className="info-pill">Software</span>
                  </div>
                }
              />
            </div>
          ) : null}

          {activeSceneTab === "audio" ? (
            <div className="scene-form-grid">
              <SettingsRow
                title="Desktop Audio"
                description="Keep arena sound cues available in local playback."
                controls={<div className="info-pill good">Enabled in recording workflow</div>}
              />
              <SettingsRow
                title="Microphone"
                description="Reserve local mic capture for future clip and coaching commentary workflows."
                controls={<div className="info-pill">Future configurable source</div>}
              />
              <SettingsRow
                title="Audio cleanup"
                description="Keep the operational hooks visible for suppression and mono input."
                controls={
                  <div className="inline-stat-group">
                    <span className="info-pill">Suppression later</span>
                    <span className="info-pill">Mono input later</span>
                  </div>
                }
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
            <div className="empty-state-actions">
              <button onClick={() => setActiveView("all")} type="button">
                Open Library
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="workspace-page">
        <header className="page-header review-header">
          <div>
            <p className="eyebrow">Review workstation</p>
            <h1>{selectedMatch.match.playerName ?? "Unknown player"}</h1>
            <div className="review-topline-row">
              <span className="info-pill">{selectedMatch.match.playerSpecLabel ?? selectedMatch.match.playerClassName ?? "Spec pending"}</span>
              <span className="info-pill">{selectedMatch.match.bracket}</span>
              <span className={`info-pill tone-${resultTone(selectedMatch.match.resultForPlayer)}`}>
                {selectedMatch.match.resultForPlayer ?? "Pending"}
              </span>
              <span className="info-pill">{selectedMatch.match.mapName}</span>
              <span className="info-pill">{formatDuration(selectedMatch.match.durationSeconds)}</span>
              <span className="info-pill">{formatDateTimeLabel(selectedMatch.match.startedAt)}</span>
            </div>
          </div>
          <div className="page-actions">
            <button onClick={() => setActiveView("all")} type="button">
              Back to Library
            </button>
            <button onClick={handleAttachVideo} disabled={isBusy} type="button">
              Attach Video
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
            <MatchRosterPanel participants={selectedMatch.participants} />
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

            <article className="summary-card">
              <div className="summary-card-topline">
                <strong>Context shortcuts</strong>
                <span className="tone-chip tone-stone">Replay level</span>
              </div>
              <div className="summary-action-grid">
                <button onClick={() => openContextualReviewTab("timeline", "Timeline")} type="button">
                  Timeline
                </button>
                <button onClick={() => openContextualReviewTab("details", "Details++")} type="button">
                  Details++
                </button>
                <button onClick={() => openContextualReviewTab("coach", "Coach")} type="button">
                  Coach
                </button>
                <button onClick={() => openContextualReviewTab("chatgpt", "ChatGPT")} type="button">
                  ChatGPT
                </button>
              </div>
            </article>
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
                <h2>Match summary</h2>
                <span>{selectedMatch.insights.length}</span>
              </div>
              <div className="review-summary-grid">
                <article className="intel-card">
                  <div className="intel-card-topline">
                    <strong>Replay package</strong>
                    <span className="tone-chip tone-stone">Library context</span>
                  </div>
                  <p>{selectedMatch.match.bracket} on {selectedMatch.match.mapName}</p>
                  <p className="muted-copy">
                    Video {selectedMatch.match.hasVideo ? "linked" : "missing"} / Analysis {selectedMatch.match.hasManualAnalysis ? "imported" : "pending"}
                  </p>
                </article>
                <article className="intel-card">
                  <div className="intel-card-topline">
                    <strong>Review readiness</strong>
                    <span className="tone-chip tone-stone">Workspace</span>
                  </div>
                  <p>{selectedMatch.timelineMarkers.length} markers connected to the current replay.</p>
                  <p className="muted-copy">{selectedMatch.videoClips.length} clips and {selectedMatch.validationTargets.length} validation targets available.</p>
                </article>
                <article className="intel-card">
                  <div className="intel-card-topline">
                    <strong>Roster context</strong>
                    <span className="tone-chip tone-stone">{selectedMatch.participants.length} players</span>
                  </div>
                  <p>One replay package, one video, and a full roster context for teammate and enemy coaching.</p>
                  <p className="muted-copy">Use the timeline and coach tabs to connect timestamps with decisions from every participant involved.</p>
                </article>
              </div>
            </div>
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
          </div>
        ) : null}

        {activeReviewTab === "video" ? (
          <div className="content-grid two-column">
            <div className="stack-card">
              <div className="section-header">
                <h2>Video workflow</h2>
                <span>{selectedMatch.match.hasVideo ? "Attached" : "Pending"}</span>
              </div>
              <div className="review-action-list">
                <button onClick={handleAttachVideo} disabled={isBusy} type="button">
                  Attach local video
                </button>
                <button onClick={handleProcessVideo} disabled={isBusy || !selectedMatch.match.videoLocalPath} type="button">
                  Process video
                </button>
                <button onClick={handleGenerateReviewClips} disabled={isBusy || !selectedMatch.match.videoLocalPath} type="button">
                  Create clips
                </button>
              </div>
            </div>
            <div className="stack-card">
              <div className="section-header">
                <h2>Replay assets</h2>
                <span>Current match</span>
              </div>
              <div className="asset-list">
                <span>Video path: {selectedMatch.match.videoLocalPath ?? "Not linked yet"}</span>
                <span>Thumbnail: {selectedMatch.match.thumbnailPath ?? "Not generated yet"}</span>
                <span>Resolution: {selectedMatch.match.videoResolution ?? "Unknown"}</span>
              </div>
            </div>
          </div>
        ) : null}

        {activeReviewTab === "timeline" ? (
          <div className="content-grid two-column">
            <div className="stack-card">
              <div className="section-header">
                <h2>Timeline markers</h2>
                <span>{selectedMatch.timelineMarkers.length}</span>
              </div>
              <TimelineMarkerRail
                durationSeconds={selectedMatch.match.durationSeconds}
                markers={selectedMatch.timelineMarkers}
              />
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
            {selectedMatch.metricSummary ? (
              <div className="metric-kpi-grid">
                <article className="kpi-card">
                  <span>Total damage</span>
                  <strong>{formatLargeNumber(selectedMatch.metricSummary.totalDamage)}</strong>
                </article>
                <article className="kpi-card">
                  <span>Total healing</span>
                  <strong>{formatLargeNumber(selectedMatch.metricSummary.totalHealing)}</strong>
                </article>
                <article className="kpi-card">
                  <span>Interrupts</span>
                  <strong>{selectedMatch.metricSummary.interruptCount}</strong>
                </article>
                <article className="kpi-card">
                  <span>Deaths</span>
                  <strong>{selectedMatch.metricSummary.deathCount}</strong>
                </article>
              </div>
            ) : null}
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
                <h2>Learning and benchmark context</h2>
                <span>{selectedMatch.benchmarkComparisons.length + selectedMatch.coachSkills.length}</span>
              </div>
              <div className="coach-context-stack">
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
                <div className="intel-grid two-up">
                  {selectedMatch.coachKnowledgeParameters.map((item) => (
                    <KnowledgeCard
                      key={`${item.scope}-${item.className ?? "none"}-${item.specLabel ?? "none"}-${item.metric}`}
                      item={item}
                    />
                  ))}
                  {selectedMatch.coachSkills.map((item) => (
                    <SkillCard
                      key={`${item.scope}-${item.className ?? "none"}-${item.specLabel ?? "none"}-${item.area}-${item.goal}`}
                      item={item}
                    />
                  ))}
                </div>
                <article className="action-card">
                  <span>Learning saves</span>
                  <div className="review-action-list">
                    <button disabled type="button">
                      Save mistake as learning note
                    </button>
                    <button disabled type="button">
                      Save burst window pattern
                    </button>
                    <button disabled type="button">
                      Save matchup benchmark
                    </button>
                  </div>
                </article>
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
            <div className="action-card">
              <span>Saved analysis</span>
              <p className="muted-copy">
                {selectedMatch.manualAnalysisText
                  ? "This replay already has imported analysis saved locally."
                  : "No manual ChatGPT analysis imported yet."}
              </p>
            </div>
            <div className="action-card full-span">
              <div className="page-actions">
                <button onClick={handleExportPrompt} disabled={isBusy} type="button">
                  Export Prompt for ChatGPT
                </button>
                <button onClick={() => void handleCopyPrompt()} disabled={isBusy || !promptText.trim()} type="button">
                  Copy Prompt
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

        {activeReviewTab === "export" ? (
          <div className="content-grid two-column">
            <div className="stack-card">
              <div className="section-header">
                <h2>Export tools</h2>
                <span>Selected replay</span>
              </div>
              <div className="review-action-list">
                <button onClick={handleExportPrompt} disabled={isBusy} type="button">
                  Export ChatGPT prompt
                </button>
                <button onClick={handleGenerateReviewClips} disabled={isBusy || !selectedMatch.match.videoLocalPath} type="button">
                  Generate review clips
                </button>
                <button onClick={handleProcessVideo} disabled={isBusy || !selectedMatch.match.videoLocalPath} type="button">
                  Process replay video
                </button>
              </div>
            </div>
            <div className="stack-card">
              <div className="section-header">
                <h2>Import tools</h2>
                <span>Manual workflow</span>
              </div>
              <div className="review-action-list">
                <button onClick={() => setActiveReviewTab("chatgpt")} type="button">
                  Open ChatGPT tab
                </button>
                <button onClick={handleAttachVideo} disabled={isBusy} type="button">
                  Attach local video
                </button>
              </div>
              <div className="asset-list">
                <span>Match JSON path: {selectedMatch.match.matchJsonPath}</span>
                <span>Video path: {selectedMatch.match.videoLocalPath ?? "Not linked yet"}</span>
              </div>
            </div>
          </div>
        ) : null}

        {activeReviewTab === "raw" ? (
          <div className="stack-card">
            <div className="section-header">
              <h2>Raw event stream</h2>
              <span>{selectedMatch.timelineMarkers.length} replay events</span>
            </div>
            <div className="raw-event-list">
              {selectedMatch.timelineMarkers.length === 0 ? (
                <p className="muted-copy">No timeline events imported yet.</p>
              ) : (
                selectedMatch.timelineMarkers.map((marker) => (
                  <article
                    key={`${marker.source}-${marker.videoSecond}-${marker.label}`}
                    className="raw-event-card"
                  >
                    <strong>{marker.label}</strong>
                    <span>{formatDuration(marker.videoSecond)} / {titleize(marker.category)} / {titleize(marker.source)}</span>
                    <p>{marker.description}</p>
                  </article>
                ))
              )}
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
    if (!selectedMatchId) {
      return (
        <div className="workspace-page">
          <div className="empty-state-card tall-empty">
            <Glyph name="clips" />
            <strong>Choose a replay first.</strong>
            <p>Open a match from the Library to see or generate replay clips in context.</p>
            <div className="empty-state-actions">
              <button onClick={() => setActiveView("all")} type="button">
                Open Library
              </button>
            </div>
          </div>
        </div>
      );
    }

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

  function renderDiagnosticsScreen() {
    const recorderReady = Boolean(settings.enableRecording && settings.recordingDirectory);

    return (
      <div className="workspace-page narrow-page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Diagnostics</p>
            <h1>Workspace health</h1>
            <p className="page-copy">
              Quick product health, storage visibility, and recording readiness. Deep exports stay inside each replay review.
            </p>
          </div>
        </header>
        <div className="verification-grid">
          <article className="summary-card">
            <div className="summary-card-topline">
              <strong>Storage</strong>
              <span className="tone-chip tone-stone">{settings.recordingDirectory ? "Configured" : "Pending"}</span>
            </div>
            <p>{settings.recordingDirectory ?? "Recording folder not configured yet."}</p>
          </article>
          <article className="summary-card">
            <div className="summary-card-topline">
              <strong>Capture pipeline</strong>
              <span className={`tone-chip tone-${recorderReady ? "success" : "warning"}`}>
                {recorderReady ? "Ready" : "Needs setup"}
              </span>
            </div>
            <p>
              {recorderReady
                ? `Arena recordings will be written to ${settings.recordingDirectory}.`
                : "Recording is still disabled or the local recording folder is missing."}
            </p>
          </article>
          <article className="summary-card">
            <div className="summary-card-topline">
              <strong>Backend</strong>
              <span className="tone-chip tone-success">Online</span>
            </div>
            <p>{systemStatus?.status ?? "Waiting for backend"}</p>
          </article>
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
            <h1>Setup summary</h1>
            <p className="page-copy">
              Keep WoW detection, addon health, backend readiness, and recording readiness in one lightweight panel.
            </p>
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
              <strong>Recording</strong>
              <span className={`tone-chip tone-${settings.enableRecording ? "success" : "warning"}`}>
                {settings.enableRecording ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p>{settings.recordingDirectory ?? "No recording location configured yet."}</p>
            {bootstrapStatus?.pendingActions.length ? (
              <p className="muted-copy">Pending bootstrap actions: {bootstrapStatus.pendingActions.join(", ")}</p>
            ) : null}
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
      case "diagnostics":
        return renderDiagnosticsScreen();
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

        <div className="sidebar-section-label">Library</div>
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

        <div className="sidebar-section-label">Workspace</div>
        <nav className="sidebar-nav secondary">
          {systemSidebarItems.map((item) => (
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
