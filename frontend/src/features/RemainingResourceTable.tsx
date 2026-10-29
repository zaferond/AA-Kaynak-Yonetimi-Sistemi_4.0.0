import { CornerDownRight } from "lucide-react";
import { ownValue } from "../../../shared/records";
import { TimelineMonthHead } from "../components/TimelineHeaders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableFooter,
  TableRow,
} from "@/components/ui/table";
import { useMemo, type RefObject } from "react";
import { directoryResponsibilityIndex } from "../../../shared/resource-roles";
import { capacityStatus } from "../capacity-status";
import { leaveDaysByMonth } from "../../../shared/actual-units";
import { versionAt } from "../../../shared/model";
import MemberBadge from "../components/MemberBadge";
import { fmt, monthLabel } from "../format";
import type { Metric } from "../metrics";
import type { Data, Team } from "../model";
import {
  expandLeadershipReportGroups,
  reportGroupManager,
  type ReportGroup,
} from "./resource-report-groups";
import EmptyState from "../components/EmptyState";
export type { ReportGroup } from "./resource-report-groups";
type Props = {
  groups: ReportGroup[];
  teamReport: boolean;
  data: Data | null;
  teams: Team[];
  months: string[];
  monthWidth: number;
  todayDate: string;
  currentMonth: string;
  currentTeamMembers: Record<string, string[]>;
  metric: (ids: string[], month: string) => Metric;
  /** Current plan while a scenario is shown: changed cells are marked. */
  compareMetric?: (ids: string[], month: string) => Metric;
  tableRef: RefObject<HTMLTableElement | null>;
};
export default function RemainingResourceTable({
  groups,
  teamReport,
  data,
  teams,
  months,
  monthWidth,
  todayDate,
  currentMonth,
  currentTeamMembers,
  metric,
  compareMetric,
  tableRef,
}: Props) {
  // Scenario view: how a cell differs from the current plan.
  const change = (ids: string[], month: string, remaining: number) => {
    if (!compareMetric) return {};
    const base = compareMetric(ids, month);
    const before = base.current - base.total;
    if (Math.abs(remaining - before) < 1e-9) return {};
    return {
      kind: remaining > before ? "better" : "worse",
      note: " · Mevcut: " + fmt(before),
    };
  };
  const responsibility = useMemo(
    () =>
      data
        ? directoryResponsibilityIndex(data, todayDate)
        : { leaders: {}, teams: {} },
    [data, todayDate],
  );
  const memberBadge = (label: string, members: string[]) => (
    <MemberBadge label={label} members={members} currentMonth={currentMonth} />
  );
  const years = [...new Set(months.map((month) => month.slice(0, 4)))];
  // Leave row: who among the reported units' people takes leave each month.
  const leaveDays = useMemo(
    () => data?.leaveDays ?? leaveDaysByMonth(data?.personCalendar),
    [data],
  );
  function leaveTakers(ids: string[], month: string) {
    const teams = new Set(ids);
    return (data?.resources || [])
      .flatMap((resource) => {
        const days = ownValue(leaveDays, resource.id + "|" + month) || 0;
        const team = versionAt(resource, month)?.team;
        return days > 0 && resource.name && team && teams.has(team)
          ? [{ name: resource.name, days }]
          : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      .map(({ name, days }) => name + " · " + fmt(days) + " gün");
  }
  function reportMonthHead(month: string) {
    return (
      <TimelineMonthHead key={month} month={month} years={years} withYear />
    );
  }
  function reportRows(groups: ReportGroup[], teamReport = false) {
    // Aggregate the same filtered units once, independent of report grouping.
    const totalIds = [...new Set(groups.flatMap((group) => group.ids))].sort();
    const displayGroups = teamReport
      ? groups
      : expandLeadershipReportGroups(data || {}, teams, groups);
    return (
      <>
        <Table
          ref={tableRef}
          todayDate={todayDate}
          todayColumn
          todayMonthsKey={months.join("|")}
          className={
            "remaining-report " + (teamReport ? "team-report" : "leader-report")
          }
          // No 100% stretch: short periods would widen the unit columns.
          style={{ width: 350 + months.length * monthWidth }}
        >
          <colgroup>
            <col style={{ width: 110 }} />
            <col style={{ width: 240 }} />
            {months.map((m) => (
              <col key={m} style={{ width: monthWidth }} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow className="yearrow leave-count-row">
              <TableHead colSpan={2}>
                Yıllık İzin <span>· izin giren kişi</span>
              </TableHead>
              {months.map((month) => {
                const takers = leaveTakers(totalIds, month);
                return (
                  <TableHead key={month} data-leave-month={month}>
                    {takers.length ? (
                      <MemberBadge
                        label={monthLabel(month)}
                        members={takers}
                        currentMonth={month}
                        heading="Yıllık İzin"
                        noun="izin giren kişi"
                        tone="info"
                      />
                    ) : (
                      <span className="leave-count-none">—</span>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
            <TableRow>
              <TableHead>Yönetici</TableHead>
              <TableHead>{teamReport ? "Takım" : "Liderlik / Birim"}</TableHead>
              {months.map(reportMonthHead)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayGroups.map((g) => (
              <TableRow
                data-report-leader={g.leader}
                data-report-depth={teamReport ? undefined : g.depth || 0}
                title={
                  g.parentLeader ? "Üst liderlik: " + g.parentLeader : undefined
                }
                key={
                  (teamReport ? "team:" : g.unitId ? "unit:" : "leader:") +
                  (teamReport ? g.ids[0] : g.unitId || g.leader || g.name)
                }
              >
                <TableCell>
                  {reportGroupManager(responsibility, teams, g, teamReport)}
                </TableCell>
                <TableCell>
                  <span
                    className="report-unit-title"
                    style={
                      g.depth
                        ? { paddingInlineStart: Math.min(g.depth, 8) * 14 }
                        : undefined
                    }
                  >
                    {!!g.depth && (
                      <CornerDownRight
                        size={13}
                        className="report-unit-branch"
                        aria-hidden="true"
                      />
                    )}
                    <span className="report-unit-name">{g.name}</span>
                    {memberBadge(
                      g.name,
                      g.ids
                        .flatMap((id) => ownValue(currentTeamMembers, id) || [])
                        .sort((a, b) => a.localeCompare(b, "tr")),
                    )}
                  </span>
                </TableCell>
                {months.map((m) => {
                  const c = metric(g.ids, m),
                    remaining = c.current - c.total,
                    diff = change(g.ids, m, remaining);
                  return (
                    <TableCell
                      key={m}
                      className={capacityStatus(c.current, c.total).className}
                      data-zero={fmt(Math.abs(remaining)) === "0" || undefined}
                      data-scenario-change={diff.kind}
                      title={
                        monthLabel(m) +
                        ": " +
                        fmt(remaining) +
                        " · " +
                        capacityStatus(c.current, c.total).label +
                        (diff.note || "")
                      }
                    >
                      <span className="table-value">{fmt(remaining)}</span>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="remaining-report-totals">
            <TableRow>
              <TableCell colSpan={2} className="remaining-total-label">
                <span className="remaining-total-heading">
                  <span className="remaining-total-icon" aria-hidden="true">
                    Σ
                  </span>
                  <strong>Toplam Eksik Kaynak</strong>
                </span>
              </TableCell>
              {months.map((month) => {
                const value = metric(totalIds, month);
                const remaining = value.current - value.total;
                const status = capacityStatus(value.current, value.total);
                const diff = change(totalIds, month, remaining);
                return (
                  <TableCell
                    key={month}
                    data-total-month={month}
                    data-zero={fmt(Math.abs(remaining)) === "0" || undefined}
                    data-scenario-change={diff.kind}
                    className={status.className}
                    title={`${monthLabel(month)}: mevcut ${fmt(value.current)} − dağıtılan ${fmt(value.total)} = ${fmt(remaining)} · ${status.label}${diff.note || ""}`}
                  >
                    <strong className="remaining-total-value">
                      {fmt(remaining)}
                    </strong>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableFooter>
        </Table>
        {!groups.length && (
          <EmptyState title="Birim bulunamadı">
            Seçili liderlik ve takım filtrelerine uyan birim yok.
          </EmptyState>
        )}
      </>
    );
  }

  return reportRows(groups, teamReport);
}
