import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  milestoneBarsForPeriods,
  calendarDayDifference,
} from "./milestone-bars";
import { phasePalette } from "./model";
import {
  changeMilestoneNoteDates,
  milestoneRanges,
  noteDates,
  rangeNotes,
  shiftCalendarDate,
  shiftMilestoneRange,
  resizeMilestoneRange,
  visibleMilestoneBarStyle,
} from "./milestone-ranges";
import { weeklyNoteLayout, type WeeklyNoteBar } from "./weekly-note-bars";
import { timelineItemLayout, type TimelineItem } from "./timeline-item-layout";
import MilestoneDiamond from "./MilestoneDiamond";
import type { MilestoneTrackProps } from "./features/project-timeline-types";
import { useMilestoneDrag } from "./features/useMilestoneDrag";
import { positionPointerTooltip } from "./features/position-pointer-tooltip";

import "./components/gantt-track.css";

import { dateLabel, barDateLabel } from "./features/timeline-labels";

/** Short ranges still draw wide enough for their text to wrap by word; the
 * stacking layout below uses the same span so widened boxes never overlap. */
const MIN_NOTE_WIDTH = 96;
const minNoteStyle = (left: number) => ({
  left: `min(${left}%, calc(100% - ${MIN_NOTE_WIDTH}px))`,
  minWidth: MIN_NOTE_WIDTH,
});

export default function MilestoneTrack({
  project: currentProject,
  projectRevision,
  milestone: currentMilestone,
  ranges: currentRanges,
  bars: currentBars,
  periods: currentPeriods,
  weeklyLayout: currentWeeklyLayout,
  isAdmin,
  saving,
  onEditMilestone,
  onMilestoneContextMenu,
  onChangeMilestoneRange,
  onChangeMilestoneNote,
}: MilestoneTrackProps) {
  const [itemHeights, setItemHeights] = useState<Record<string, number>>({});
  const [trackWidth, setTrackWidth] = useState(1000);
  const [hoveredPoint, setHoveredPoint] = useState<{
    name: string;
    date: string;
    completed: boolean;
  } | null>(null);
  const [hoveredNote, setHoveredNote] = useState<WeeklyNoteBar | null>(null);
  const noteTooltipRef = useRef<HTMLDivElement>(null);
  const notePointerRef = useRef({ x: 0, y: 0 });
  const {
    interaction,
    isInteracting,
    isNoteDragging,
    trackRef,
    suppressClickRef,
    dragging,
    preview,
    notePreview,
    beginDrag,
    moveDrag,
    endDrag,
    cancelDrag,
    beginNoteDrag,
    moveNoteDrag,
    endNoteDrag,
    cancelNoteDrag,
  } = useMilestoneDrag({
    project: currentProject,
    projectRevision,
    milestone: currentMilestone,
    periods: currentPeriods,
    isAdmin,
    saving,
    onChangeMilestoneRange,
    onChangeMilestoneNote,
    onBeginRange: () => setHoveredPoint(null),
    onBeginNote: () => setHoveredNote(null),
  });
  // Keep index-based bars/notes and previews on the pointer-down value even if
  // a background read changes their order. The server checks its opening revision.
  const frozenLayout = useMemo(() => {
    if (!interaction) return null;
    const ranges = milestoneRanges(interaction.milestone);
    return {
      ranges,
      bars: milestoneBarsForPeriods(ranges, interaction.periods),
      weeklyLayout: interaction.periods.some((period) => period.kind === "week")
        ? weeklyNoteLayout(ranges, interaction.periods)
        : null,
    };
  }, [interaction]);
  const project = interaction?.snapshot.project || currentProject;
  const milestone = interaction?.milestone || currentMilestone;
  const periods = interaction?.periods || currentPeriods;
  const ranges = frozenLayout?.ranges || currentRanges;
  const bars = frozenLayout?.bars || currentBars;
  const weeklyLayout = frozenLayout
    ? frozenLayout.weeklyLayout
    : currentWeeklyLayout;
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setTrackWidth(track.offsetWidth || 1000);
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    measure();
    return () => observer.disconnect();
  }, [periods]);

  useEffect(() => setHoveredNote(null), [periods]);
  useLayoutEffect(() => {
    if (hoveredNote || hoveredPoint)
      positionPointerTooltip(
        noteTooltipRef.current,
        notePointerRef.current.x,
        notePointerRef.current.y,
      );
  }, [hoveredNote, hoveredPoint]);
  useEffect(() => {
    if (!hoveredNote && !hoveredPoint) return;
    const hide = () => {
      setHoveredNote(null);
      setHoveredPoint(null);
    };
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [hoveredNote, hoveredPoint]);

  const defaultColor =
    phasePalette.find((item) => item.id === (milestone.barColor || "red")) ||
    phasePalette[3];
  const splitMonthlyRanges = new Set(
    ranges.flatMap((range, index) =>
      new Set(
        rangeNotes(range)
          .filter((note) => note.text.trim())
          .map((note) => {
            const dates = noteDates(note, range);
            return dates.start + "|" + dates.end;
          }),
      ).size > 1
        ? [index]
        : [],
    ),
  );
  const noteLayoutForRanges = (values: typeof ranges) => {
    if (weeklyLayout) return weeklyNoteLayout(values, periods);
    if (!splitMonthlyRanges.size) return null;
    const result = weeklyNoteLayout(values, periods);
    return {
      ...result,
      bars: result.bars
        .filter((note) => splitMonthlyRanges.has(note.rangeIndex))
        .flatMap((note) => {
          const position = milestoneBarsForPeriods(
            [{ ...values[note.rangeIndex], start: note.start, end: note.end }],
            periods,
          )[0];
          return position
            ? [{ ...note, left: position.left, width: position.width }]
            : [];
        }),
    };
  };
  let displayedWeeklyLayout = noteLayoutForRanges(ranges);
  if (displayedWeeklyLayout && notePreview?.days && !notePreview.message) {
    try {
      const changed = changeMilestoneNoteDates(
        project,
        milestone,
        notePreview.rangeIndex,
        notePreview.noteIndex,
        notePreview.mode,
        notePreview.days,
      );
      displayedWeeklyLayout = noteLayoutForRanges(milestoneRanges(changed));
    } catch {
      /* Keep the last valid layout while an invalid drag is shown in the status tooltip. */
    }
  }
  useLayoutEffect(() => {
    const elements = Array.from(
      trackRef.current?.querySelectorAll<HTMLButtonElement>(
        "[data-timeline-item]",
      ) || [],
    );
    const measure = () => {
      const next = Object.fromEntries(
        elements.map((element) => [
          element.dataset.timelineItem!,
          element.offsetHeight,
        ]),
      );
      setItemHeights((previous) =>
        Object.keys(previous).length === Object.keys(next).length &&
        Object.entries(next).every(([key, height]) => previous[key] === height)
          ? previous
          : next,
      );
    };
    const observer = new ResizeObserver(measure);
    elements.forEach((element) => observer.observe(element));
    measure();
    return () => observer.disconnect();
  }, [bars, weeklyLayout, notePreview?.days]);
  // Ranges sharing the same dates draw as one bar listing their notes one
  // under another; the first range of the group carries the bar.
  const sameDates = new Map<string, number[]>();
  if (!weeklyLayout)
    bars.forEach((bar, index) => {
      if (
        bar.range.displayKind === "milestone" ||
        splitMonthlyRanges.has(ranges.indexOf(bar.range))
      )
        return;
      const key = bar.range.start + "|" + bar.range.end;
      sameDates.set(key, [...(sameDates.get(key) || []), index]);
    });
  const groupOf = new Map<number, number[]>();
  const grouped = new Set<number>();
  for (const members of sameDates.values()) {
    groupOf.set(members[0], members);
    members.slice(1).forEach((index) => grouped.add(index));
  }
  const weeklyGroups = new Map<string, WeeklyNoteBar[]>();
  for (const note of displayedWeeklyLayout?.bars || []) {
    const key = note.start + "|" + note.end;
    weeklyGroups.set(key, [...(weeklyGroups.get(key) || []), note]);
  }
  const pointLabelGeometry = (left: number, width: number) => {
    const center = ((left + width / 2) * trackWidth) / 100;
    const side = center > trackWidth / 2 ? "left" : "right";
    const available = side === "left" ? center - 22 : trackWidth - center - 22;
    return { center, side, width: Math.min(240, Math.max(0, available)) };
  };
  // Pixel span of a note box as drawn with minNoteStyle.
  const noteSpan = (left: number, right: number) => {
    const width = Math.max(MIN_NOTE_WIDTH, right - left);
    const start = Math.max(0, Math.min(left, trackWidth - MIN_NOTE_WIDTH));
    return { left: start, right: start + width };
  };
  const items: TimelineItem[] = bars.flatMap((bar, index) => {
    if (grouped.has(index)) return [];
    const id = "range:" + index;
    const left = (bar.left * trackWidth) / 100;
    if (bar.range.displayKind === "milestone") {
      const label = pointLabelGeometry(bar.left, bar.width);
      return [
        {
          id,
          left:
            label.center - 15 - (label.side === "left" ? label.width + 8 : 0),
          right:
            label.center + 15 + (label.side === "right" ? label.width + 8 : 0),
          minimumHeight: 56,
        },
      ];
    }
    return weeklyLayout || splitMonthlyRanges.has(ranges.indexOf(bar.range))
      ? []
      : [
          {
            id,
            ...noteSpan(left, left + (bar.width * trackWidth) / 100),
            minimumHeight: 24,
          },
        ];
  });
  for (const entries of weeklyGroups.values()) {
    const note = entries[0];
    items.push({
      id: `note:${note.rangeIndex}.${note.noteIndex}`,
      ...noteSpan(
        (note.left * trackWidth) / 100 + 2,
        ((note.left + note.width) * trackWidth) / 100 - 2,
      ),
      minimumHeight: 39 * entries.length + (entries.length > 1 ? 26 : 0),
    });
  }
  const layout = timelineItemLayout(items, itemHeights);
  const dragStatus = notePreview || preview;
  return (
    <div
      ref={trackRef}
      className={"milestone-track" + (weeklyLayout ? " weekly-note-track" : "")}
      style={
        {
          "--milestone-period-width": 100 / periods.length + "%",
          height: layout.height,
        } as CSSProperties
      }
    >
      {bars.map((bar, index) => {
        if (grouped.has(index)) return null;
        const members = groupOf.get(index) || [index];
        const shared = members.length > 1;
        const rangeIndex = ranges.indexOf(bar.range);
        const changed =
          preview?.rangeIndex === rangeIndex && preview.days && !preview.message
            ? preview.mode === "move"
              ? shiftMilestoneRange(
                  project,
                  milestone,
                  rangeIndex,
                  preview.days,
                )
              : resizeMilestoneRange(
                  project,
                  milestone,
                  rangeIndex,
                  preview.mode,
                  preview.days,
                )
            : null;
        const displayed = changed
          ? milestoneBarsForPeriods(
              [milestoneRanges(changed)[rangeIndex]],
              periods,
            )[0] || bar
          : bar;
        const entries = members.flatMap((member) => {
          const range = member === index ? displayed.range : bars[member].range;
          const notes = rangeNotes(range).filter((note) => note.text.trim());
          return notes.length
            ? notes.map((note) => ({
                text: note.text,
                completed: !!note.completed,
                ...noteDates(note, range),
              }))
            : [
                {
                  text: milestone.name,
                  completed: false,
                  start: range.start,
                  end: range.end,
                },
              ];
        });
        const details = entries.map(
          (entry) =>
            "• " +
            (entry.completed ? "Tamamlandı: " : "") +
            entry.text +
            " · " +
            dateLabel(entry.start) +
            " – " +
            dateLabel(entry.end),
        );
        const barColor =
          phasePalette.find((item) => item.id === bar.range.color) ||
          defaultColor;
        const barStyle = {
          "--gantt-color": barColor.ink,
          "--gantt-soft": barColor.bg,
          "--gantt-ink": barColor.ink,
          ...minNoteStyle(displayed.left),
          top: layout.centers["range:" + index],
          width: displayed.width + "%",
        } as CSSProperties;
        if (bar.range.displayKind === "milestone")
          return (
            <button
              type="button"
              key={index}
              data-timeline-item={"range:" + index}
              className={"milestone-point" + (dragging ? " dragging" : "")}
              style={
                {
                  left: displayed.left + displayed.width / 2 + "%",
                  top: layout.centers["range:" + index],
                  "--point-label-width":
                    pointLabelGeometry(displayed.left, displayed.width).width +
                    "px",
                } as CSSProperties
              }
              data-label-side={
                pointLabelGeometry(displayed.left, displayed.width).side
              }
              data-completed={
                !!rangeNotes(bar.range)[0]?.completed || undefined
              }
              aria-label={
                "Milestone: " +
                (rangeNotes(bar.range)[0]?.text || milestone.name) +
                " · " +
                dateLabel(displayed.range.start)
              }
              onMouseEnter={(event) => {
                if (dragging) return;
                notePointerRef.current = {
                  x: event.clientX,
                  y: event.clientY,
                };
                setHoveredPoint({
                  name: rangeNotes(bar.range)[0]?.text || milestone.name,
                  date: displayed.range.start,
                  completed: !!rangeNotes(bar.range)[0]?.completed,
                });
              }}
              onMouseMove={(event) => {
                if (!dragging)
                  positionPointerTooltip(
                    noteTooltipRef.current,
                    event.clientX,
                    event.clientY,
                  );
              }}
              onMouseLeave={() => setHoveredPoint(null)}
              onFocus={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                notePointerRef.current = {
                  x: rect.left + rect.width / 2,
                  y: rect.bottom,
                };
                setHoveredPoint({
                  name: rangeNotes(bar.range)[0]?.text || milestone.name,
                  date: displayed.range.start,
                  completed: !!rangeNotes(bar.range)[0]?.completed,
                });
              }}
              onBlur={() => setHoveredPoint(null)}
              onClick={() => {
                if (isInteracting() || suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                if (isAdmin && !saving) onEditMilestone(milestone);
              }}
              onPointerDown={(event) => beginDrag(event, rangeIndex, "move")}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={cancelDrag}
              onContextMenu={(event) => {
                if (isInteracting()) {
                  event.preventDefault();
                  return;
                }
                setHoveredPoint(null);
                onMilestoneContextMenu(event, milestone, rangeIndex);
              }}
            >
              <MilestoneDiamond
                color={barColor.border}
                style={bar.range.diamondStyle}
                completed={!!rangeNotes(bar.range)[0]?.completed}
              />
              <span className="milestone-point-label">
                <strong>
                  {rangeNotes(bar.range)[0]?.completed && "✓ "}
                  {rangeNotes(bar.range)[0]?.text || milestone.name}
                </strong>
                <time dateTime={displayed.range.start}>
                  {barDateLabel(displayed.range.start)}
                </time>
              </span>
            </button>
          );
        if (weeklyLayout || splitMonthlyRanges.has(rangeIndex)) return null;
        return (
          <button
            type="button"
            key={index}
            data-timeline-item={"range:" + index}
            className={
              "gantt-bar start end " +
              visibleMilestoneBarStyle(milestone.barStyle) +
              (isAdmin ? " editable" : "") +
              (dragging && preview?.rangeIndex === rangeIndex
                ? " dragging"
                : "")
            }
            data-completed={
              entries.every((entry) => entry.completed) || undefined
            }
            style={barStyle}
            title={`${milestone.name} · ${dateLabel(displayed.range.start)} – ${dateLabel(displayed.range.end)}\n${details.join("\n")}${isAdmin ? (shared ? "\nTıklayın: düzenle" : "\nTıklayın: düzenle · Basılı tutup sürükleyin: taşı · Uçlardan sürükleyin: daralt / genişlet") : ""}`}
            aria-label={details.join(", ")}
            onClick={() => {
              if (isInteracting() || suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              if (isAdmin && !saving) onEditMilestone(milestone);
            }}
            onPointerDown={(event) => {
              // Dragging one range of a shared bar would split the group.
              if (!shared) beginDrag(event, rangeIndex, "move");
            }}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={cancelDrag}
            onContextMenu={(event) => {
              if (isInteracting()) {
                event.preventDefault();
                return;
              }
              onMilestoneContextMenu(event, milestone, rangeIndex);
            }}
          >
            {entries.length > 1 && (
              <div className="gantt-group-heading">
                {barDateLabel(displayed.range.start)} →{" "}
                {barDateLabel(displayed.range.end)}
                <span>{entries.length} detay not</span>
              </div>
            )}
            <ul className="gantt-note-list">
              {entries.map((entry, noteIndex) => (
                <li
                  key={noteIndex}
                  className={entry.completed ? "completed" : undefined}
                >
                  <strong className="gantt-note-text">
                    {entry.completed ? "✓ " : "○ "}
                    {entry.text}
                  </strong>
                  <small className="gantt-note-dates">
                    <time dateTime={entry.start}>
                      {barDateLabel(entry.start)}
                    </time>{" "}
                    –{" "}
                    <time dateTime={entry.end}>{barDateLabel(entry.end)}</time>
                  </small>
                </li>
              ))}
            </ul>
            {isAdmin &&
              !shared &&
              (["start", "end"] as const).map((edge) => (
                <span
                  key={edge}
                  className={"gantt-resize-handle " + edge}
                  role="presentation"
                  title={
                    edge === "start"
                      ? "Başlangıç tarihini sürükleyin"
                      : "Bitiş tarihini sürükleyin"
                  }
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    beginDrag(event, rangeIndex, edge);
                  }}
                  onPointerMove={(event) => {
                    event.stopPropagation();
                    moveDrag(event);
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    endDrag(event);
                  }}
                  onPointerCancel={(event) => {
                    event.stopPropagation();
                    cancelDrag(event);
                  }}
                  onClick={(event) => event.stopPropagation()}
                />
              ))}
          </button>
        );
      })}
      {[...weeklyGroups.values()].map((entries) => {
        const note = entries[0];
        const shared = entries.length > 1;
        const tooltipNote = {
          ...note,
          text: entries
            .map(
              (entry) =>
                (entry.completed ? "✓ " : "") +
                entry.text +
                " · " +
                barDateLabel(entry.start) +
                " – " +
                barDateLabel(entry.end),
            )
            .join("\n"),
          completed: entries.every((entry) => entry.completed),
        };
        const color =
          phasePalette.find((item) => item.id === note.color) || defaultColor;
        const active =
          notePreview?.rangeIndex === note.rangeIndex &&
          notePreview.noteIndex === note.noteIndex;
        return (
          <button
            type="button"
            key={`${note.rangeIndex}-${note.noteIndex}`}
            data-timeline-item={`note:${note.rangeIndex}.${note.noteIndex}`}
            className={
              "weekly-note-box " +
              (!weeklyLayout ? "gantt-bar " : "") +
              visibleMilestoneBarStyle(milestone.barStyle) +
              (entries.every((entry) => entry.completed) ? " completed" : "") +
              (isAdmin ? " editable" : "") +
              (active ? " dragging" : "")
            }
            style={
              {
                ...minNoteStyle(note.left),
                width: note.width + "%",
                top: layout.centers[
                  `note:${note.rangeIndex}.${note.noteIndex}`
                ],
                "--gantt-color": color.ink,
                "--gantt-soft": color.bg,
                "--gantt-ink": color.ink,
              } as CSSProperties
            }
            aria-label={tooltipNote.text}
            data-note-count={entries.length}
            title={shared ? "Tıklayın: tüm açıklamaları düzenle" : undefined}
            onMouseEnter={(event) => {
              if (isNoteDragging()) return;
              notePointerRef.current = { x: event.clientX, y: event.clientY };
              setHoveredNote(tooltipNote);
            }}
            onMouseMove={(event) => {
              if (isNoteDragging()) return;
              notePointerRef.current = { x: event.clientX, y: event.clientY };
              positionPointerTooltip(
                noteTooltipRef.current,
                event.clientX,
                event.clientY,
              );
            }}
            onMouseLeave={() => setHoveredNote(null)}
            onFocus={(event) => {
              if (isNoteDragging()) return;
              const rect = event.currentTarget.getBoundingClientRect();
              notePointerRef.current = {
                x: rect.left + rect.width / 2,
                y: rect.bottom,
              };
              setHoveredNote(tooltipNote);
            }}
            onBlur={() => setHoveredNote(null)}
            onClick={() => {
              setHoveredNote(null);
              if (isInteracting() || suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              if (isAdmin && !saving) onEditMilestone(milestone);
            }}
            onContextMenu={(event) => {
              if (isInteracting()) {
                event.preventDefault();
                return;
              }
              setHoveredNote(null);
              onMilestoneContextMenu(event, milestone, note.rangeIndex);
            }}
            onPointerDown={(event) => {
              if (!shared) beginNoteDrag(event, note, "move");
            }}
            onPointerMove={moveNoteDrag}
            onPointerUp={endNoteDrag}
            onPointerCancel={cancelNoteDrag}
          >
            {shared && (
              <div className="gantt-group-heading">
                {barDateLabel(note.start)} → {barDateLabel(note.end)}
                <span>{entries.length} detay not</span>
              </div>
            )}
            <ul className="gantt-note-list">
              {entries.map((entry) => (
                <li
                  key={`${entry.rangeIndex}.${entry.noteIndex}`}
                  className={entry.completed ? "completed" : undefined}
                >
                  <strong className="weekly-note-text">
                    {entry.completed ? "✓ " : "○ "}
                    {entry.text}
                  </strong>
                  <small className="gantt-note-dates">
                    <time dateTime={entry.start}>
                      {barDateLabel(entry.start)}
                    </time>{" "}
                    –{" "}
                    <time dateTime={entry.end}>{barDateLabel(entry.end)}</time>
                  </small>
                </li>
              ))}
            </ul>
            {isAdmin &&
              !shared &&
              (["start", "end"] as const).map((edge) => (
                <span
                  key={edge}
                  className={"weekly-note-resize " + edge}
                  role="presentation"
                  title={
                    edge === "start"
                      ? "Başlangıç tarihini günlük olarak sürükleyin"
                      : "Bitiş tarihini günlük olarak sürükleyin"
                  }
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    beginNoteDrag(event, note, edge);
                  }}
                  onPointerMove={(event) => {
                    event.stopPropagation();
                    moveNoteDrag(event);
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    endNoteDrag(event);
                  }}
                  onPointerCancel={(event) => {
                    event.stopPropagation();
                    cancelNoteDrag(event);
                  }}
                  onClick={(event) => event.stopPropagation()}
                />
              ))}
          </button>
        );
      })}
      {(hoveredNote || hoveredPoint) &&
        createPortal(
          <div
            ref={noteTooltipRef}
            className="project-phase-tooltip weekly-note-tooltip"
            role="tooltip"
            style={{ left: -10000, top: -10000 }}
          >
            {hoveredPoint ? (
              <>
                <strong
                  className={hoveredPoint.completed ? "completed" : undefined}
                >
                  {hoveredPoint.name}
                </strong>
                <small>Milestone · {dateLabel(hoveredPoint.date)}</small>
                {hoveredPoint.completed && <em>Tamamlandı</em>}
              </>
            ) : (
              hoveredNote && (
                <>
                  <strong
                    className={hoveredNote.completed ? "completed" : undefined}
                  >
                    {hoveredNote.text}
                  </strong>
                  <small>
                    {dateLabel(hoveredNote.start)} –{" "}
                    {dateLabel(hoveredNote.end)}
                  </small>
                  {hoveredNote.completed && <em>Tamamlandı</em>}
                </>
              )
            )}
          </div>,
          document.body,
        )}
      {dragStatus &&
        createPortal(
          <div
            className={
              "gantt-drag-status" + (dragStatus.message ? " invalid" : "")
            }
            role="status"
            style={{
              left: Math.max(
                8,
                Math.min(dragStatus.x - 105, window.innerWidth - 222),
              ),
              top: Math.max(8, dragStatus.y - 94),
            }}
          >
            <strong>
              {notePreview
                ? dragStatus.mode === "move"
                  ? "Detay taşınıyor"
                  : dragStatus.mode === "start"
                    ? "Detay başlangıcı"
                    : "Detay bitişi"
                : dragStatus.mode === "move"
                  ? "Taşınıyor"
                  : dragStatus.mode === "start"
                    ? "Başlangıç ayarlanıyor"
                    : "Bitiş ayarlanıyor"}{" "}
              <span>
                {dragStatus.days > 0 ? "+" : ""}
                {dragStatus.days} gün
              </span>
            </strong>
            <div>
              <span>
                <small>Başlangıç</small>
                {dateLabel(dragStatus.start)}
              </span>
              <span>
                <small>Bitiş</small>
                {dateLabel(dragStatus.end)}
              </span>
            </div>
            {dragStatus.message ? (
              <p>{dragStatus.message}</p>
            ) : (
              <em>
                {calendarDayDifference(dragStatus.start, dragStatus.end) + 1}{" "}
                gün sürer
              </em>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
