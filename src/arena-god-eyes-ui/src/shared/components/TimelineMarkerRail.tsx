import type { TimelineMarkerItem } from "../types/api";

type TimelineMarkerRailProps = {
  markers: TimelineMarkerItem[];
  durationSeconds: number;
};

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function categorySymbol(category: string) {
  switch (category.toLowerCase()) {
    case "mistake":
      return "!";
    case "defensive":
      return "D";
    case "cc":
      return "C";
    case "interrupt":
      return "I";
    case "improvement":
      return "+";
    default:
      return "•";
  }
}

export function TimelineMarkerRail({
  markers,
  durationSeconds,
}: TimelineMarkerRailProps) {
  return (
    <div className="timeline-shell">
      <div className="timeline-axis">
        {markers.map((marker) => {
          const left =
            durationSeconds > 0
              ? Math.min(100, (marker.videoSecond / durationSeconds) * 100)
              : 0;

          return (
            <div
              key={`${marker.source}-${marker.videoSecond}-${marker.label}`}
              className={`timeline-pin severity-${marker.severity.toLowerCase()}`}
              style={{ left: `${left}%` }}
              title={`${formatSeconds(marker.videoSecond)} - ${marker.label}`}
            >
              <span>{categorySymbol(marker.category)}</span>
            </div>
          );
        })}
      </div>

      <div className="marker-list">
        {markers.length === 0 ? (
          <p className="muted-copy">No markers yet. Import a ChatGPT response to populate the timeline.</p>
        ) : (
          markers.map((marker) => (
            <article
              key={`${marker.source}-${marker.videoSecond}-${marker.label}-card`}
              className={`marker-card severity-${marker.severity.toLowerCase()}`}
            >
              <div className="marker-time">{formatSeconds(marker.videoSecond)}</div>
              <div>
                <h3>{marker.label}</h3>
                <p>{marker.description}</p>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
