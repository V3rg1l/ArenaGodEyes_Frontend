import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../../shared/lib/api";
import { Panel } from "../../shared/components/Panel";
import { TimelineMarkerRail } from "../../shared/components/TimelineMarkerRail";
import type {
  AppSettings,
  CoachKnowledgeParameterItem,
  CoachSkillItem,
  MatchLibraryItem,
  MatchReviewDetails,
  MatchSpellMetricItem,
  ObsConnectionStatus,
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
  | "citadel"
  | "spark"
  | "camera"
  | "shield"
  | "swords"
  | "radar"
  | "insight";

function toLocalFileSource(path: string | null) {
  if (!path) {
    return undefined;
  }

  if (/^https?:\/\//i.test(path) || /^file:\/\//i.test(path)) {
    return path;
  }

  const normalized = path.replace(/\\/g, "/");
  return `file:///${normalized}`;
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
    return item.className ? `${item.className} · ${item.specLabel}` : item.specLabel;
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
      return "growth";
    case "stun":
    case "fear":
    case "silence":
    case "disorient":
    case "incapacitate":
    case "horror":
    case "root":
      return "blood";
    case "offensive_cooldown":
    case "damage":
    case "dot":
      return "ember";
    default:
      return "stone";
  }
}

function Glyph({ name }: { name: GlyphName }) {
  const paths: Record<GlyphName, ReactNode> = {
    citadel: (
      <>
        <path d="M4 18V8l4 2 4-4 4 4 4-2v10" />
        <path d="M8 18v-4h8v4" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3v5" />
        <path d="m8 11 4-3 4 3-4 10z" />
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
    swords: (
      <>
        <path d="m7 4 10 10" />
        <path d="m17 4-10 10" />
        <path d="m6 18 2-2" />
        <path d="m16 18 2-2" />
      </>
    ),
    radar: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 12 18 8" />
      </>
    ),
    insight: (
      <>
        <path d="M12 4a6 6 0 0 1 3.6 10.8c-.8.6-1.3 1.4-1.6 2.2h-4c-.3-.8-.8-1.6-1.6-2.2A6 6 0 0 1 12 4Z" />
        <path d="M9.5 20h5" />
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
      <div className="snapshot-grid">
        <article className="snapshot-card">
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
    <div className="snapshot-grid">
      {items.map(([label, value]) => (
        <article key={label} className="snapshot-card">
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

function SpellMetricCard({ metric }: { metric: MatchSpellMetricItem }) {
  return (
    <article className="intel-card spell-card">
      <div className="intel-card-topline">
        <strong>{metric.spellName}</strong>
        <span className={`tone-chip tone-${categoryTone(metric.primaryCategory)}`}>
          {titleize(metric.primaryCategory ?? metric.tacticalPhase ?? "unknown")}
        </span>
      </div>
      <p className="muted-copy">
        {(metric.className ?? "Unknown class") +
          (metric.specLabel ? ` · ${metric.specLabel}` : "") +
          (metric.tacticalPhase ? ` · ${titleize(metric.tacticalPhase)}` : "")}
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
        {scopeLabel(item)} · target {item.targetValue ?? "unknown"}
        {item.unit ? ` (${item.unit})` : ""} · evidence {item.evidenceCount}
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
      <p className="muted-copy">evidence {item.evidenceCount}</p>
      {item.drill ? <p>{item.drill}</p> : null}
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

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!selectedMatchId) {
      return;
    }

    void loadMatch(selectedMatchId);
  }, [selectedMatchId]);

  const libraryStats = useMemo(
    () => ({
      total: matches.length,
      analyzed: matches.filter((match) => match.hasManualAnalysis).length,
      withVideo: matches.filter((match) => match.hasVideo).length,
    }),
    [matches],
  );

  const categorizedSpells = useMemo(() => {
    if (!selectedMatch) {
      return [];
    }

    return [...selectedMatch.spellMetrics]
      .sort((left, right) => right.castCount + right.totalDamage + right.totalHealing - (left.castCount + left.totalDamage + left.totalHealing))
      .slice(0, 12);
  }, [selectedMatch]);

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
      setStatusMessage(
        result.isReachable
          ? "OBS connection succeeded."
          : result.errorMessage ?? "OBS connection failed.",
      );
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
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to import manual analysis.",
      );
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

  return (
    <main className="home-page">
      <section className="hero-stage">
        <div className="hero-copy">
          <p className="home-kicker">ArenaGodEyes replay desk</p>
          <h1>Post-match coaching with evidence, clips, metrics, and memory.</h1>
          <p className="home-summary">
            Safe Blizzard-compliant analysis only. Build the match record, review the
            video, export the coach prompt, and keep growing class/spec knowledge in
            the local database.
          </p>
          <div className="hero-badges">
            <span className="hero-badge"><Glyph name="shield" /> Post-match only</span>
            <span className="hero-badge"><Glyph name="camera" /> OBS + FFmpeg review</span>
            <span className="hero-badge"><Glyph name="insight" /> Manual ChatGPT coach loop</span>
          </div>
        </div>

        <div className="hero-signal-grid">
          <article className="signal-card signal-primary">
            <p className="signal-label">System pulse</p>
            <strong>{systemStatus?.status ?? "loading"}</strong>
            <span>{systemStatus?.safety ?? "Safe post-match analysis only."}</span>
            <p className="signal-message">{statusMessage}</p>
          </article>
          <article className="signal-card signal-mini">
            <Glyph name="citadel" />
            <strong>{libraryStats.total}</strong>
            <span>matches indexed</span>
          </article>
          <article className="signal-card signal-mini">
            <Glyph name="camera" />
            <strong>{libraryStats.withVideo}</strong>
            <span>matches with video</span>
          </article>
          <article className="signal-card signal-mini">
            <Glyph name="insight" />
            <strong>{libraryStats.analyzed}</strong>
            <span>manual coach reviews</span>
          </article>
        </div>
      </section>

      <section className="command-grid">
        <aside className="control-column">
          <Panel
            title="Arena Setup"
            eyebrow="Local command deck"
            actions={
              <div className="button-row">
                <button onClick={handleDetectWowPath} disabled={isBusy} type="button">
                  Detect WoW
                </button>
                <button onClick={handleInstallAddon} disabled={isBusy} type="button">
                  Install Addon
                </button>
              </div>
            }
          >
            <div className="settings-grid">
              <label>
                <span>WoW Retail Path</span>
                <input
                  value={settings.wowRetailPath ?? ""}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      wowRetailPath: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Combat Log Directory</span>
                <input
                  value={settings.combatLogDirectory ?? ""}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      combatLogDirectory: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Recording Directory</span>
                <input
                  value={settings.recordingDirectory ?? ""}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      recordingDirectory: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>OBS Host</span>
                <input
                  value={settings.obsHost}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      obsHost: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>OBS Port</span>
                <input
                  type="number"
                  value={settings.obsPort}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      obsPort: Number(event.target.value) || 0,
                    }))
                  }
                />
              </label>
              <label>
                <span>OBS Password</span>
                <input
                  type="password"
                  value={settings.obsPassword ?? ""}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      obsPassword: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>FFmpeg Path</span>
                <input
                  value={settings.ffmpegExecutablePath ?? ""}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      ffmpegExecutablePath: event.target.value || null,
                    }))
                  }
                />
              </label>
              <label>
                <span>FFprobe Path</span>
                <input
                  value={settings.ffprobeExecutablePath ?? ""}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      ffprobeExecutablePath: event.target.value || null,
                    }))
                  }
                />
              </label>
              <label>
                <span>OBS Timeout (s)</span>
                <input
                  type="number"
                  value={settings.obsConnectTimeoutSeconds}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      obsConnectTimeoutSeconds: Number(event.target.value) || 5,
                    }))
                  }
                />
              </label>
              <label>
                <span>Thumbnail Second</span>
                <input
                  type="number"
                  value={settings.videoThumbnailSecond}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      videoThumbnailSecond: Number(event.target.value) || 5,
                    }))
                  }
                />
              </label>
            </div>

            <div className="toggle-row">
              <label>
                <input
                  checked={settings.enableMatchDetection}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      enableMatchDetection: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                Enable match detection
              </label>
              <label>
                <input
                  checked={settings.enableObsRecording}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      enableObsRecording: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                Auto OBS recording during detected matches
              </label>
            </div>

            <p className="signal-message">
              Live watcher can start OBS on arena start, import the match on arena end,
              and stop OBS only if this app started the recording.
            </p>

            <div className="button-row">
              <button onClick={handleSaveSettings} disabled={isBusy} type="button">
                Save Settings
              </button>
              <button onClick={handleValidateSettings} disabled={isBusy} type="button">
                Validate Setup
              </button>
            </div>

            <div className="button-row">
              <button onClick={handleTestObsConnection} disabled={isBusy} type="button">
                Test OBS
              </button>
              <button onClick={handleStartObsRecording} disabled={isBusy} type="button">
                Start Recording
              </button>
              <button onClick={handleStopObsRecording} disabled={isBusy} type="button">
                Stop Recording
              </button>
            </div>

            {obsStatus ? (
              <div className="obs-status-shell">
                <strong>OBS {obsStatus.isReachable ? "online" : "offline"}</strong>
                <p>
                  Version: {obsStatus.obsVersion ?? "unknown"} · Recording:{" "}
                  {obsStatus.isRecording ? "active" : "idle"}
                </p>
                <p>{obsStatus.outputPath ?? obsStatus.errorMessage ?? "No active OBS output path."}</p>
              </div>
            ) : null}

            {validation ? (
              <div className={`validation-shell ${validation.isValid ? "valid" : "invalid"}`}>
                <strong>{validation.isValid ? "Healthy setup" : "Setup needs fixes"}</strong>
                <ul>
                  {validation.messages.length === 0 ? (
                    <li>Everything looks ready for local review.</li>
                  ) : (
                    validation.messages.map((message) => <li key={message}>{message}</li>)
                  )}
                </ul>
              </div>
            ) : null}
          </Panel>

          <Panel
            title="Import Command Deck"
            eyebrow="Capture and index"
            actions={
              <div className="button-row">
                <button onClick={handleImportSample} disabled={isBusy} type="button">
                  Import Sample
                </button>
                <button onClick={handleImportCombatLog} disabled={isBusy} type="button">
                  Import Combat Log
                </button>
              </div>
            }
          >
            <div className="snapshot-grid compact-snapshot-grid">
              <article className="snapshot-card">
                <span>stored</span>
                <strong>{libraryStats.total}</strong>
              </article>
              <article className="snapshot-card">
                <span>reviewed</span>
                <strong>{libraryStats.analyzed}</strong>
              </article>
              <article className="snapshot-card">
                <span>with video</span>
                <strong>{libraryStats.withVideo}</strong>
              </article>
            </div>
          </Panel>

          <Panel title="Match Library" eyebrow="Replay queue">
            <div className="match-list">
              {matches.length === 0 ? (
                <p className="muted-copy">
                  Import the sample chunk or a local combat log to populate the library.
                </p>
              ) : (
                matches.map((match) => (
                  <button
                    key={match.matchId}
                    className={`match-row ${selectedMatchId === match.matchId ? "active" : ""}`}
                    onClick={() => setSelectedMatchId(match.matchId)}
                    type="button"
                  >
                    <div className="match-row-main">
                      <strong>{match.playerName ?? "Unknown player"}</strong>
                      <span>
                        {[match.playerClassName, match.playerSpecLabel].filter(Boolean).join(" · ") || "Class/spec pending"}
                      </span>
                      <span>
                        {match.bracket} · {match.mapName}
                      </span>
                    </div>
                    <div className="match-row-meta">
                      <span>{formatDuration(match.durationSeconds)}</span>
                      <span>{formatDateLabel(match.startedAt)}</span>
                      <span>{match.timelineMarkerCount} markers</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Panel>
        </aside>

        <section className="review-column">
          <Panel
            title="Review Stage"
            eyebrow={selectedMatch?.match.matchId ?? "Select a match"}
            actions={
              <div className="button-row">
                <button
                  onClick={handleAttachVideo}
                  disabled={isBusy || !selectedMatch}
                  type="button"
                >
                  Attach Video
                </button>
                <button
                  onClick={handleExportPrompt}
                  disabled={isBusy || !selectedMatch}
                  type="button"
                >
                  Export Prompt
                </button>
                <button
                  onClick={handleProcessVideo}
                  disabled={isBusy || !selectedMatch?.match.videoLocalPath}
                  type="button"
                >
                  Process Video
                </button>
                <button
                  onClick={handleGenerateReviewClips}
                  disabled={isBusy || !selectedMatch?.match.videoLocalPath}
                  type="button"
                >
                  Generate Clips
                </button>
              </div>
            }
          >
            {selectedMatch ? (
              <>
                <section className="review-banner">
                  <div className="review-banner-copy">
                    <p className="panel-eyebrow">Active match</p>
                    <h3>
                      {selectedMatch.match.playerName ?? "Unknown player"} ·{" "}
                      {selectedMatch.match.playerClassName ?? "Unknown class"}
                      {selectedMatch.match.playerSpecLabel ? ` / ${selectedMatch.match.playerSpecLabel}` : ""}
                    </h3>
                    <p className="muted-copy">
                      {selectedMatch.match.mapName} · {selectedMatch.match.bracket} ·{" "}
                      {formatDuration(selectedMatch.match.durationSeconds)}
                    </p>
                  </div>
                  <div className="review-badges">
                    <span className="review-topline-chip">{selectedMatch.match.resultForPlayer ?? "result pending"}</span>
                    <span className="review-topline-chip">{selectedMatch.match.recordingStatus ?? "recording status unknown"}</span>
                    {selectedMatch.match.videoResolution ? (
                      <span className="review-topline-chip">{selectedMatch.match.videoResolution}</span>
                    ) : null}
                    <span className="review-topline-chip">{selectedMatch.timelineMarkers.length} markers</span>
                  </div>
                </section>

                <div className="review-stage-grid">
                  <div className="media-stage">
                    {selectedMatch.match.thumbnailPath ? (
                      <img
                        alt="Match thumbnail"
                        className="video-thumbnail"
                        src={toLocalFileSource(selectedMatch.match.thumbnailPath)}
                      />
                    ) : null}

                    <div className="video-shell">
                      {selectedMatch.match.videoLocalPath ? (
                        <video
                          controls
                          className="video-player"
                          src={toLocalFileSource(selectedMatch.match.videoLocalPath)}
                        />
                      ) : (
                        <div className="video-placeholder">
                          <Glyph name="camera" />
                          <strong>No local video linked yet.</strong>
                          <span>
                            Link a recording file now. Timeline markers, coach notes, and
                            validation targets will still land in the review stage.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="coach-stage">
                    <div className="coach-stage-card">
                      <div className="intel-card-topline">
                        <strong>Spec snapshot</strong>
                        <span className="tone-chip tone-stone">
                          {selectedMatch.specPerformanceSnapshot?.className ?? "Unknown"}
                        </span>
                      </div>
                      <p className="muted-copy">
                        Class/spec inference is built from spell usage and `WoWInfo`, then
                        reused by metrics and coach memory.
                      </p>
                      <SnapshotRail snapshot={selectedMatch.specPerformanceSnapshot} />
                    </div>

                    {selectedMatch.metricSummary ? (
                      <div className="coach-stage-card metric-summary-grid">
                        <article>
                          <span>Total casts</span>
                          <strong>{formatLargeNumber(selectedMatch.metricSummary.totalCasts)}</strong>
                        </article>
                        <article>
                          <span>Total damage</span>
                          <strong>{formatLargeNumber(selectedMatch.metricSummary.totalDamage)}</strong>
                        </article>
                        <article>
                          <span>Total healing</span>
                          <strong>{formatLargeNumber(selectedMatch.metricSummary.totalHealing)}</strong>
                        </article>
                        <article>
                          <span>DPS</span>
                          <strong>{selectedMatch.metricSummary.damagePerSecond}</strong>
                        </article>
                        <article>
                          <span>HPS</span>
                          <strong>{selectedMatch.metricSummary.healingPerSecond}</strong>
                        </article>
                        <article>
                          <span>Casts/min</span>
                          <strong>{selectedMatch.metricSummary.castsPerMinute}</strong>
                        </article>
                      </div>
                    ) : null}
                  </div>
                </div>

                <TimelineMarkerRail
                  durationSeconds={selectedMatch.match.durationSeconds}
                  markers={selectedMatch.timelineMarkers}
                />

                <div className="intel-grid two-up">
                  <label className="review-block">
                    <span>Manual ChatGPT Prompt</span>
                    <textarea readOnly value={promptText} />
                  </label>

                  <label className="review-block">
                    <span>Paste ChatGPT Response</span>
                    <textarea
                      value={manualResponseText}
                      onChange={(event) => setManualResponseText(event.target.value)}
                    />
                  </label>
                </div>

                <section className="section-heading">
                  <div>
                    <p className="panel-eyebrow">Spell intelligence</p>
                    <h3>Class/spec-enriched breakdown</h3>
                  </div>
                </section>
                <div className="intel-grid three-up">
                  {categorizedSpells.length === 0 ? (
                    <p className="muted-copy">No spell metrics persisted yet.</p>
                  ) : (
                    categorizedSpells.map((metric) => (
                      <SpellMetricCard key={`${metric.normalizedSpellName}-${metric.specLabel ?? "unknown"}`} metric={metric} />
                    ))
                  )}
                </div>

                <section className="section-heading">
                  <div>
                    <p className="panel-eyebrow">Coach memory</p>
                    <h3>Knowledge, skills, clips, and audit targets</h3>
                  </div>
                </section>

                <div className="intel-grid two-up">
                  <div className="review-block review-list-block">
                    <span>Coach Knowledge</span>
                    {selectedMatch.coachKnowledgeParameters.length === 0 ? (
                      <p className="muted-copy">No accumulated coach parameters yet.</p>
                    ) : (
                      selectedMatch.coachKnowledgeParameters.map((item) => (
                        <KnowledgeCard
                          key={`${item.scope}-${item.className ?? "none"}-${item.specLabel ?? "none"}-${item.metric}`}
                          item={item}
                        />
                      ))
                    )}
                  </div>

                  <div className="review-block review-list-block">
                    <span>Coach Skills</span>
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

                  <div className="review-block review-list-block">
                    <span>Review Clips</span>
                    {selectedMatch.videoClips.length === 0 ? (
                      <p className="muted-copy">
                        No clips generated yet. Process the video and generate clips from markers,
                        insights, and validation targets.
                      </p>
                    ) : (
                      <div className="clip-grid">
                        {selectedMatch.videoClips.map((clip) => (
                          <article
                            key={`${clip.source}-${clip.videoSecond}-${clip.label}`}
                            className="clip-card"
                          >
                            <strong>{clip.label}</strong>
                            <p>
                              {formatDuration(clip.startSecond)} to {formatDuration(clip.endSecond)} ·{" "}
                              {clip.category}
                            </p>
                            <video
                              controls
                              className="clip-player"
                              src={toLocalFileSource(clip.clipPath)}
                            />
                          </article>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="review-block review-list-block">
                    <span>Structured Insights</span>
                    {selectedMatch.insights.length === 0 ? (
                      <p className="muted-copy">No structured insights imported yet.</p>
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

                  <div className="review-block review-list-block full-span">
                    <span>Validation Targets</span>
                    {selectedMatch.validationTargets.length === 0 ? (
                      <p className="muted-copy">No validation targets imported yet.</p>
                    ) : (
                      <div className="intel-grid two-up">
                        {selectedMatch.validationTargets.map((target) => (
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
                              {target.currentValue ?? "unknown"} → {target.expectedValue ?? "target"}
                              {target.unit ? ` (${target.unit})` : ""}
                            </p>
                            {target.note ? <p className="muted-copy">{target.note}</p> : null}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="button-row import-analysis-row">
                  <button
                    onClick={handleImportManualAnalysis}
                    disabled={isBusy || !manualResponseText.trim()}
                    type="button"
                  >
                    Import Manual Analysis
                  </button>
                </div>

                <label className="review-block raw-json">
                  <span>Match JSON</span>
                  <textarea readOnly value={selectedMatch.matchJson} />
                </label>
              </>
            ) : (
              <div className="empty-stage">
                <Glyph name="radar" />
                <strong>Select or import a match to open the review workspace.</strong>
              </div>
            )}
          </Panel>
        </section>
      </section>
    </main>
  );
}
