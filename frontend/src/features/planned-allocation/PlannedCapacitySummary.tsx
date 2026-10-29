import { ChevronDown } from "lucide-react";
import { Table, TableBody } from "@/components/ui/table";
import PlannedTableHeaders from "./PlannedTableHeaders";
import PlannedSummaryRows from "./PlannedSummaryRows";
import type { PlannedAllocationProps } from "./types";
export default function PlannedCapacitySummary(
  props: Pick<
    PlannedAllocationProps,
    | "showCapacity"
    | "onCapacityChange"
    | "capacityTableRef"
    | "todayDate"
    | "months"
    | "labelWidth"
    | "monthWidth"
    | "teams"
    | "metric"
    | "projects"
    | "projectIds"
    | "projectTotals"
  >,
) {
  const {
    showCapacity,
    onCapacityChange,
    capacityTableRef,
    todayDate,
    months,
    labelWidth,
    monthWidth,
  } = props;
  return (
    <details
      className="capacitystrip planned-capacity-summary"
      aria-label="Filtrelenen Takımlar Özet Raporu"
      open={showCapacity}
      onToggle={(e) => onCapacityChange(e.currentTarget.open)}
    >
      <summary>
        <span className="capacitystrip-action">
          {showCapacity
            ? "Kalan Kaynak Raporunu Kapat"
            : "Kalan Kaynak Raporunu Aç"}
          <ChevronDown size={17} aria-hidden="true" />
        </span>
      </summary>
      {showCapacity && (
        <Table
          ref={capacityTableRef}
          todayDate={todayDate}
          todayColumn
          todayMonthsKey={months.join("|")}
          className="matrix planning-grid allocation-grid"
          // No 100% stretch: short periods would widen the label column.
          style={{ width: labelWidth + months.length * monthWidth }}
        >
          <PlannedTableHeaders
            months={months}
            labelWidth={labelWidth}
            monthWidth={monthWidth}
            label=""
          />
          <TableBody>
            <PlannedSummaryRows {...props} selectedReport />
          </TableBody>
        </Table>
      )}
    </details>
  );
}
