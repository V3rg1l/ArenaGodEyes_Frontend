import { useEffect, useState } from "react";
import { api } from "../../shared/lib/api";
import { Panel } from "../../shared/components/Panel";
import { TimelineMarkerRail } from "../../shared/components/TimelineMarkerRail";
import type {
  AppSettings,
  MatchLibraryItem,
  MatchReviewDetails,
  SettingsValidationResult,
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

function toVideoSource(videoPath: string | null) {
  if (!videoPath) {
    return undefined;
  }

  if (/^https?:\/\//i.test(videoPath) || /^file:\/\//i.test(videoPath)) {
    return videoPath;
  }

  const normalized = videoPath.replace(/\\/g, "/");
  return `file:///${normalized}`;
}

function formatDuration(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function HomePage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [settings, setSettings] = useState<AppSettings>(emptySettings);
  const [validation, setValidation] = useState<SettingsValidationResult | null>(null);
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
      setStatusMessage("Backend online. Ready to import logs and review matches.");
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
      <section className="home-hero">
        <div>
          <p className="home-kicker">ArenaGodEyes Desktop MVP</p>
          <h1>Review the match, not the myth.</h1>
          <p className="home-summary">
            Import combat logs, generate a local match JSON, export a manual
            ChatGPT prompt, and bring timestamped advice back into the timeline.
          </p>
        </div>

        <div className="signal-card">
          <p className="signal-label">System</p>
          <strong>{systemStatus?.status ?? "loading"}</strong>
          <span>{systemStatus?.safety ?? "Safe post-match analysis only."}</span>
          <p className="signal-message">{statusMessage}</p>
        </div>
      </section>

      <section className="home-layout">
        <div className="home-column">
          <Panel
            title="Desktop Settings"
            eyebrow="Local configuration"
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
                OBS recording
              </label>
            </div>

            <div className="button-row">
              <button onClick={handleSaveSettings} disabled={isBusy} type="button">
                Save Settings
              </button>
              <button onClick={handleValidateSettings} disabled={isBusy} type="button">
                Validate Setup
              </button>
            </div>

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
            eyebrow="MVP actions"
            actions={
              <div className="button-row">
                <button onClick={handleImportSample} disabled={isBusy} type="button">
                  Import Sample Match
                </button>
                <button onClick={handleImportCombatLog} disabled={isBusy} type="button">
                  Import Combat Log
                </button>
              </div>
            }
          >
            <div className="metric-band">
              <article>
                <strong>{matches.length}</strong>
                <span>Matches stored</span>
              </article>
              <article>
                <strong>{matches.filter((match) => match.hasManualAnalysis).length}</strong>
                <span>With manual analysis</span>
              </article>
              <article>
                <strong>{matches.filter((match) => match.hasVideo).length}</strong>
                <span>With linked video</span>
              </article>
            </div>
          </Panel>

          <Panel title="Match Library" eyebrow="2v2 / 3v3 / shuffle / skirmish">
            <div className="match-list">
              {matches.length === 0 ? (
                <p className="muted-copy">
                  Import the sample chunk or a local combat log to populate the
                  library.
                </p>
              ) : (
                matches.map((match) => (
                  <button
                    key={match.matchId}
                    className={`match-row ${selectedMatchId === match.matchId ? "active" : ""}`}
                    onClick={() => setSelectedMatchId(match.matchId)}
                    type="button"
                  >
                    <div>
                      <strong>{match.playerName ?? "Unknown player"}</strong>
                      <span>
                        {match.bracket} · {match.mapName}
                      </span>
                    </div>
                    <div className="match-row-meta">
                      <span>{formatDuration(match.durationSeconds)}</span>
                      <span>{match.timelineMarkerCount} markers</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="home-column review-column">
          <Panel
            title="Match Review"
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
              </div>
            }
          >
            {selectedMatch ? (
              <>
                <div className="review-topline">
                  <span>{selectedMatch.match.playerSpecLabel ?? "Unknown spec"}</span>
                  <span>{selectedMatch.match.resultForPlayer ?? "result pending"}</span>
                  <span>{selectedMatch.match.mapName}</span>
                  <span>{formatDuration(selectedMatch.match.durationSeconds)}</span>
                </div>

                <div className="video-shell">
                  {selectedMatch.match.videoLocalPath ? (
                    <video
                      controls
                      className="video-player"
                      src={toVideoSource(selectedMatch.match.videoLocalPath)}
                    />
                  ) : (
                    <div className="video-placeholder">
                      <strong>No local video linked yet.</strong>
                      <span>
                        Link a recording file now. The timeline markers will
                        still be created from imported ChatGPT timestamps.
                      </span>
                    </div>
                  )}
                </div>

                <TimelineMarkerRail
                  durationSeconds={selectedMatch.match.durationSeconds}
                  markers={selectedMatch.timelineMarkers}
                />

                <div className="review-grid">
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

                <div className="button-row">
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
              <p className="muted-copy">
                Select or import a match to open the review workspace.
              </p>
            )}
          </Panel>
        </div>
      </section>
    </main>
  );
}
