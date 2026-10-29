import { createWorkspaceDataActions } from "./features/workspace/workspace-data-actions";
import { useMessageToast } from "./features/workspace/useFilterAppliedToast";
import HomePage from "./features/workspace/HomePage";
import GlobalSearch, {
  type SearchItem,
} from "./features/workspace/GlobalSearch";
import { menuTabs } from "./features/workspace/menu-tabs";
import Badge from "./components/Badge";
import { createProjectActions } from "./features/workspace/project-actions";
import { createWorkspaceExports } from "./features/workspace/workspace-exports";
import {
  readWorkspaceOptions,
  planWorkspacePath,
} from "./features/workspace/workspace-options";
import { useWorkspaceFilters } from "./features/workspace/useWorkspaceFilters";
import { useWorkspaceView } from "./features/workspace/useWorkspaceView";
import { useSynchronizedTableScroll } from "./features/workspace/useSynchronizedTableScroll";
import { usePortalData } from "./features/usePortalData";
import WriteRecoveryNotice from "./features/WriteRecoveryNotice";
import { usePortalRefresh } from "./features/usePortalRefresh";
import { usePortalEditor } from "./features/usePortalEditor";
import { useWorkspaceNavigation } from "./features/workspace/useWorkspaceNavigation";
import { useWorkspaceMenu } from "./features/workspace/useWorkspaceMenu";
import WorkspaceHeader, { FullPlanHeader } from "./features/WorkspaceHeader";
import WorkspaceNavigation, {
  type ReportView,
  type ProjectView,
} from "./features/WorkspaceNavigation";
import WorkspaceFilters from "./features/WorkspaceFilters";
import PlannedAllocationPanel from "./features/PlannedAllocationPanel";
import { visibleProjectsByCompletion } from "../../shared/project-completion";
import { useOnlyDataRows } from "./features/workspace/useOnlyDataRows";
import { isProjectEditor } from "../../shared/project-access.ts";
import { useProjectMenus } from "./features/useProjectMenus";
import ProjectContextMenus from "./features/ProjectContextMenus";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TabsContent } from "@/components/ui/tabs";
import { Tabs as TabsPrimitive } from "radix-ui";
import { ClipboardPaste, Copy } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useActualView } from "./features/actual-allocation/useActualView";
import { useActivityReport } from "./features/activity-report/useActivityReport";
import ActivePostingPlanningToggle, {
  activePostingsIncluded,
} from "./features/workspace/ActivePostingPlanningToggle";
import PortalEditorDialog from "./features/PortalEditorDialog";
import ScenarioReportBar from "./features/schedule-scenario/ScenarioReportBar";
import { useScheduleScenarios } from "./features/schedule-scenario/useScheduleScenarios";
import { usePlannedGrid } from "./features/usePlannedGrid";
import { fmt, monthLabel } from "./format";
import { Project } from "./model";
import { phaseChipStyle } from "./phase-chip";
import PersonAllocationPanel from "./PersonAllocationPanel";
import type { ActualUnit } from "./actual-units";
import ErrorBoundary from "./ErrorBoundary";
import { mergeNewerActuals } from "./features/actual-allocation/merge-actual-view";
import type { ProgressView } from "./features/project-progress/ProjectProgressPanel";
import { useActualLayout } from "./features/actual-allocation/useActualLayout";
import { progressBadgeIndex } from "./features/project-progress/ProgressBadge";
import ProjectResponsible from "./ProjectResponsible";
import ProjectTimelinePanel from "./features/ProjectTimelinePanel";
import ResourcesPanel from "./features/ResourcesPanel";
import {
  DEFAULT_FILTERS,
  RISK_MANAGEMENT_ENABLED,
  TAB_LABELS,
} from "./settings";
import { captureSessionGuard, currentUser, readLocal } from "./storage";
import AllocationResetPanel from "./features/AllocationResetPanel";
import { lazyPanel, preloadPanels } from "./lazy-panel";

// Screens opened from the menu load on first use; the planning grid, projects
// and actual entry stay in the main chunk.
const AbsenceReport = lazyPanel(() => import("./AbsenceReport"));
const MonthlyActivityReport = lazyPanel(
  () => import("./features/activity-report/MonthlyActivityReport"),
);
const WorkspaceReports = lazyPanel(
  () => import("./features/workspace/WorkspaceReports"),
);
const HeadcountReports = lazyPanel(
  () => import("./features/resource-reports/HeadcountReports"),
);
const AccessPanel = lazyPanel(() => import("./AccessPanel"));
const ProjectInfoReport = lazyPanel(() => import("./ProjectInfoReport"));
const ProjectProgressPanel = lazyPanel(
  () => import("./features/project-progress/ProjectProgressPanel"),
);
const RiskManagement = lazyPanel(() => import("./RiskManagement"));
const TeamDirectory = lazyPanel(() => import("./TeamDirectory"));
// Mounted closed for admins and managers: nothing to show while it loads.
const ScheduleScenarioDialog = lazyPanel(
  () => import("./features/schedule-scenario/ScheduleScenarioDialog"),
  null,
);
("use client");
const openingOptions = readWorkspaceOptions(
  window.location.search,
  DEFAULT_FILTERS,
);
const fullPlan = openingOptions.fullPlan;
export default function Portal() {
  const assertSessionRef = useRef(captureSessionGuard());
  const [directoryEditing, setDirectoryEditing] = useState(false);
  const [accountEditing, setAccountEditing] = useState(false);
  const [organizationView, setOrganizationView] = useState("employees");
  const [reportView, setReportView] = useState<ReportView>("resources");
  const [projectView, setProjectView] = useState<ProjectView>("projects");
  const [showCompletedPlanProjects, setShowCompletedPlanProjects] =
    useState(false);
  const [showCompletedActualProjects, setShowCompletedActualProjects] =
    useState(false);
  const [progressActionsHost, setProgressActionsHost] =
    useState<HTMLDivElement | null>(null);
  const [progressCountsHost, setProgressCountsHost] =
    useState<HTMLSpanElement | null>(null);
  const [progressView, setProgressView] = useState<ProgressView>("plan");
  const [actualLayout, setActualLayout] = useActualLayout();
  const [actualUnit, setActualUnit] = useState<ActualUnit>("percent");
  const [activityUnit, setActivityUnit] = useState<ActualUnit>("percent");
  const [sharedCalendarOpen, setSharedCalendarOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [sidebarHost, setSidebarHost] = useState<HTMLDivElement | null>(null);
  const mainTabsRef = useRef<HTMLDivElement>(null),
    capacityTableRef = useRef<HTMLTableElement>(null),
    planTableRef = useRef<HTMLTableElement>(null);
  const [phaseDetail, setPhaseDetail] = useState<{
    project: Project;
    month: string;
  } | null>(null);
  const projectLabelWidth = 230;
  const planningLabelWidth = 220;
  const [browserFullScreen, setBrowserFullScreen] = useState(
    !!document.fullscreenElement,
  );
  const [showImport, setShowImport] = useState(false);
  const {
    data,
    setData,
    user,
    setUser,
    error,
    setError,
    notice,
    noticeId,
    setNotice,
    saving,
    setSaving,
    reload,
    save,
    batch,
    saveEmployee,
    change,
  } = usePortalData(assertSessionRef);
  const isAdmin = user?.role === "admin";
  // "Normal-Proje": admin rights on the project screens only.
  const canEditProjects = isAdmin || isProjectEditor(user);
  const isManager = user?.role === "manager";
  const canEditCriticalTopics = canEditProjects || isManager;
  const progressDrafts = useRef(new Set<string>());
  const [progressEditing, setProgressEditing] = useState(false);
  const onProgressDraftChange = useCallback((id: string, dirty: boolean) => {
    if (dirty) progressDrafts.current.add(id);
    else progressDrafts.current.delete(id);
    setProgressEditing(progressDrafts.current.size > 0);
  }, []);
  const confirmProgressLeave = useCallback(
    () =>
      !progressDrafts.current.size ||
      window.confirm("Kaydedilmemiş değerlendirme değişiklikleri silinsin mi?"),
    [],
  );
  const {
    tab,
    defaultTab,
    setOpeningTab,
    riskLeaveGuard,
    riskEditingRef,
    riskEditing,
    onRiskEditingChange,
    flushRiskDraft,
    changeTab,
    signOut,
  } = useWorkspaceNavigation({
    confirmProgressLeave,
    user,
    fullPlan,
    assertSessionRef,
    setError,
    setNotice,
  });
  useEffect(() => {
    if (tab !== "progress" || (!isAdmin && progressView === "settings"))
      setProgressView("plan");
    if (tab !== "projects" || (!isAdmin && !isManager))
      setProjectView("projects");
  }, [tab, isAdmin, isManager]);
  useEffect(() => {
    if (tab !== "actual" || !isAdmin) setSharedCalendarOpen(false);
  }, [tab, isAdmin]);
  const [searchOpen, setSearchOpen] = useState(false);
  // Ctrl+K (Cmd+K on a Mac) opens the search from any screen.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // The other screens download in the background once this one is shown, so
  // they open at once later. The sign-in screen and first paint stay light.
  useEffect(() => {
    const handle = window.setTimeout(() => void preloadPanels(), 300);
    return () => window.clearTimeout(handle);
  }, []);
  const progressBadges = useMemo(
    () =>
      data && (isAdmin || isManager) ? progressBadgeIndex(data) : new Map(),
    [data, isAdmin, isManager],
  );
  const {
    leads,
    setLeads,
    teamIds,
    setTeamIds,
    projectIds,
    setProjectIds,
    start,
    setStart,
    count,
    setCount,
    search,
    setSearch,
    view,
    setView,
    density: chosenDensity,
    setDensity,
    cells,
    setCells,
    cellSet,
    resourceIds,
    setResourceIds,
    personIds,
    setPersonIds,
    planPage,
    setPlanPage,
    projectPage,
    setProjectPage,
    resourcePage,
    setResourcePage,
    showAllActual,
    setShowAllActual,
    expandedActualTeams,
    setExpandedActualTeams,
    showCapacity,
    setShowCapacity,
    showProjectDetails,
    setShowProjectDetails,
    projectWeekly,
    setProjectWeekly,
    showProjectCodes,
    setShowProjectCodes,
    filterResetKey,
    resetFilters,
    todayDate,
    currentMonth,
    months,
  } = useWorkspaceFilters(openingOptions, tab, setNotice);
  // Only Projeler lets the user pick a density; the planning, evaluation and
  // report screens read best compact, activity entry in full detail.
  const density: typeof chosenDensity = [
    "plan",
    "progress",
    "overview",
  ].includes(tab)
    ? "compact"
    : tab === "actual"
      ? "detail"
      : chosenDensity;
  const [onlyDataRows, setOnlyDataRows] = useOnlyDataRows(user?.id);
  const activity = useActivityReport(
    tab === "activity" && !!data,
    data,
    start,
    count,
    projectIds,
    currentMonth,
  );
  // The snapshot returned by the user's own actual save (see loading below).
  const ownActualSave = useRef<unknown>(null);
  const actualView = useActualView(
    tab === "actual" && !!data && !isAdmin,
    data,
    start,
    count,
    currentMonth,
    user,
  );
  const viewData = useMemo(
    () =>
      tab === "activity" && data
        ? {
            ...data,
            teams: activity.catalog?.teams || [],
            leaders: activity.catalog?.leaders || [],
            leaderParents: activity.catalog?.leaderParents || {},
          }
        : tab === "actual" && !isAdmin && data
          ? actualView.value
            ? mergeNewerActuals(actualView.value.data, data)
            : { ...data, teams: [], resources: [] }
          : data,
    [tab, data, activity.catalog, actualView.value, isAdmin],
  );
  const monthWidth =
    density === "overview" ? 24 : density === "compact" ? 68 : 150;
  const projectMonthWidth =
    density === "overview" ? 24 : density === "compact" ? 68 : 110;
  const planMonthWidth =
    density === "overview" ? 23 : density === "compact" ? 60 : 120;
  const reportMonthWidth =
    density === "overview" ? 24 : density === "compact" ? 56 : 100;
  const labelWidth = density === "overview" ? 210 : 240;
  // 5 yıllık genel bakışta haftalık sütunlar okunamaz; görünüm aylık kalır.
  const timelineWeekly = projectWeekly && density !== "overview";
  const {
    editor,
    setEditor,
    formError,
    setFormError,
    openProject,
    deleteProject,
    openMilestone,
    deleteMilestone,
    deleteEditedMilestone,
    openResource,
    chooseResourceStatus,
    openBulk,
    submit,
  } = usePortalEditor({
    data,
    isAdmin: !!isAdmin,
    canEditProjects,
    canEditMilestones: canEditProjects || (isManager && tab === "critical"),
    saving,
    start,
    count,
    leads: tab === "resources" ? [] : leads,
    resourceIds,
    batch,
    saveEmployee,
    setError,
    setNotice,
    onProjectDeleted: (id) => {
      setProjectIds((ids) => ids.filter((item) => item !== id));
      setCells((keys) => keys.filter((key) => key.split("|")[1] !== id));
    },
    onSubmitted: () => setResourceIds([]),
  });
  function load() {
    return reload(() => setEditor(null));
  }
  usePortalRefresh({
    load,
    editing: !!editor || directoryEditing || accountEditing || progressEditing,
    saving,
    riskEditing,
    riskEditingRef,
    assertSessionRef,
    setError,
  });
  useEffect(() => {
    setPlanMenu(null);
  }, [leads, teamIds, projectIds, start, count, search, view]);
  useEffect(() => {
    if (!canEditProjects && !(isManager && tab === "critical")) setEditor(null);
  }, [canEditProjects, isManager, tab, user?.role]);
  useEffect(() => {
    if (!fullPlan) return;
    const sync = () => setBrowserFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (fullPlan) history.replaceState(null, "", planWorkspaceUrl());
  }, [view, start, count, density, leads, teamIds, projectIds]);
  useSynchronizedTableScroll({
    enabled: !!data && tab === "plan" && view === "project" && showCapacity,
    primaryRef: planTableRef,
    secondaryRef: capacityTableRef,
    layoutKey: months.join("|") + ":" + planMonthWidth,
  });
  const projectWorkspaceData = useMemo(
    () =>
      tab === "projects" && viewData
        ? {
            ...viewData,
            projects: viewData.projects.filter(
              (project) =>
                !!project.completed === (projectView === "completedProjects"),
            ),
          }
        : viewData,
    [viewData, tab, projectView],
  );
  const {
    leaderItems,
    leaderFilterItems,
    availableTeams,
    teams,
    projects,
    ids,
    leaderReportGroups,
    teamReportGroups,
    availablePeople,
    capacityFilters,
    currentTeamMembers,
    cache,
    projectTotals,
    actualTotals,
    metric,
    planPageSize,
    effectivePlanPage,
    planGroups,
    effectiveProjectPage,
    visiblePlanRows,
  } = useWorkspaceView(projectWorkspaceData, user, {
    leads,
    teamIds,
    projectIds,
    start,
    count,
    view,
    density,
    months,
    currentMonth,
    planPage,
    projectPage,
    onlyDataRows,
    hideCompletedPlanProjects: tab === "plan" && !showCompletedPlanProjects,
  });
  const scenarioState = useScheduleScenarios(
    viewData,
    months,
    currentMonth,
    user?.id,
  );
  // Resource reports drawn for a delay scenario (nothing is saved).
  const reportScenario =
    tab === "overview" && reportView === "resources"
      ? scenarioState.report
      : null;
  const plannedGrid = usePlannedGrid({
    visiblePlanRows,
    months,
    cells,
    setCells,
    planTableRef,
    data,
    saving,
    user,
    active: tab === "plan" && !editor && !phaseDetail,
    batch,
    setNotice,
    setError,
  });
  const {
    planMenu,
    setPlanMenu,
    planMenuRef,
    copiedPlan,
    planCellWritable,
    copyPlanSelection,
    pastePlanSelection,
  } = plannedGrid;
  const projectMenus = useProjectMenus({
    data,
    months,
    visibleProjects: projects,
    active: tab === "projects" && !editor && !phaseDetail,
    selectionKey: JSON.stringify([
      projectView,
      effectiveProjectPage,
      leads,
      teamIds,
      projectIds,
      start,
      count,
      search,
      timelineWeekly,
    ]),
    isAdmin: canEditProjects,
    saving,
    batch,
    setNotice,
    setError,
  });
  const { openPhaseMenu, openMilestoneMenu } = projectMenus;
  const { resetAll, deleteResources, downloadBackup, restoreBackupFile } =
    createWorkspaceDataActions({
      data,
      saving,
      setSaving,
      setData,
      setError,
      setNotice,
      batch,
      change,
      isAdmin: !!isAdmin,
      setCells,
      setResourceIds,
      flushRiskDraft,
      assertSession: () => assertSessionRef.current(),
      load,
    });
  const {
    reorderProject,
    reorderMilestone,
    changeMilestoneRange,
    changeMilestoneNote,
  } = createProjectActions({
    data,
    saving,
    batch,
    setNotice,
    setError,
    isAdmin: canEditProjects,
  });
  const { exportCurrentTab } = createWorkspaceExports({
    data: viewData,
    actualMonthSummaries: actualView.value?.monthSummaries,
    user,
    tab,
    reportView,
    todayDate,
    teams,
    projects:
      tab === "plan"
        ? visibleProjectsByCompletion(projects, showCompletedPlanProjects)
        : tab === "actual"
          ? visibleProjectsByCompletion(projects, showCompletedActualProjects)
          : projects,
    months,
    density,
    projectWeekly: timelineWeekly,
    showProjectCodes,
    currentMonth,
    start,
    personIds,
    leads,
    teamIds,
    leaderReportGroups,
    teamReportGroups,
    metric: reportScenario?.metric || metric,
    scenarioLabel: reportScenario
      ? reportScenario.scenario.name + " (senaryo, kayıtlar değişmedi)"
      : undefined,
    activityRows: activity.value?.rows,
    activityUnit,
    projectIds,
    setError,
  });
  function phaseText(p: Project, m: string) {
    return m < p.start || m > p.end
      ? "Proje dönemi dışında"
      : p.phases[m] || "Çalışma bilgisi girilmemiş";
  }
  function planWorkspaceUrl() {
    return planWorkspacePath(window.location.href, {
      view,
      start,
      count,
      density,
      leads,
      teamIds,
      projectIds,
    });
  }
  async function toggleBrowserFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice(
        "Tarayıcı ekranı kaplamaya izin vermedi; geniş sekme görünümü açık kalır.",
      );
    }
  }
  const editTeams = data?.teams || [];
  const workspaceFilters = data && (
    <WorkspaceFilters
      data={projectWorkspaceData || data}
      tab={tab}
      leads={leads}
      setLeads={setLeads}
      teamIds={teamIds}
      setTeamIds={setTeamIds}
      projectIds={projectIds}
      setProjectIds={setProjectIds}
      personIds={personIds}
      setPersonIds={setPersonIds}
      leaderItems={leaderFilterItems}
      availableTeams={availableTeams}
      availablePeople={availablePeople}
      start={start}
      setStart={setStart}
      count={count}
      setCount={setCount}
      density={density}
      setDensity={setDensity}
      filterResetKey={filterResetKey}
      resetFilters={resetFilters}
      showPeriodFilters={tab !== "overview" || reportView !== "headcount"}
    />
  );
  const workspaceMenu = useWorkspaceMenu(tab);
  // Notices show on every screen, also those without a filter bar.
  const messageToast = useMessageToast(notice, noticeId);
  const searchItems = useMemo((): SearchItem[] => {
    const screens = menuTabs(user);
    const can = (value: string) => screens.some((t) => t.value === value);
    return [
      ...screens.map(({ value, Icon }) => ({
        kind: "screen" as const,
        id: value,
        name: TAB_LABELS[value as keyof typeof TAB_LABELS],
        Icon,
      })),
      ...(can("projects")
        ? (viewData?.projects || []).map((p) => ({
            kind: "project" as const,
            id: p.id,
            name: p.name,
            detail: p.responsibleName || undefined,
          }))
        : []),
      ...(can("plan")
        ? [
            ...leaderFilterItems.map((l) => ({
              kind: "leader" as const,
              id: l.id,
              name: l.name,
            })),
            ...availableTeams.map((t) => ({
              kind: "team" as const,
              id: t.id,
              name: t.name,
              detail: t.lead || undefined,
            })),
          ]
        : []),
      ...(can("actual")
        ? (viewData?.resources || [])
            .filter((r) => r.name)
            .map((r) => ({ kind: "person" as const, id: r.id, name: r.name }))
        : []),
    ];
  }, [user, viewData, leaderFilterItems, availableTeams]);
  /** A pick narrows the filters to it, then opens the screen that shows it. */
  function openSearchItem(item: SearchItem) {
    if (item.kind === "screen") return changeTab(item.id);
    if (item.kind === "project") {
      setProjectIds([item.id]);
      return changeTab("projects");
    }
    if (item.kind === "leader") {
      setTeamIds([]);
      setLeads([item.id]);
      return changeTab("plan");
    }
    if (item.kind === "team") {
      setLeads([]);
      setTeamIds([item.id]);
      return changeTab("plan");
    }
    setLeads([]);
    setTeamIds([]);
    setPersonIds([item.id]);
    return changeTab("actual");
  }
  return (
    <div
      className={
        "app dense-" +
        density +
        " tab-" +
        tab +
        (fullPlan ? " full-plan" : "") +
        (workspaceMenu.pinned ? " menu-pinned" : "")
      }
      style={
        {
          "--month-width":
            (tab === "plan"
              ? planMonthWidth
              : tab === "overview"
                ? reportMonthWidth
                : tab === "projects"
                  ? projectMonthWidth
                  : monthWidth) + "px",
          "--label-width":
            (tab === "projects"
              ? projectLabelWidth
              : tab === "plan"
                ? planningLabelWidth
                : tab === "actual"
                  ? 200
                  : labelWidth) + "px",
        } as React.CSSProperties
      }
    >
      <div className="workspace-sidebar-host" ref={setSidebarHost} />
      {messageToast}
      <WorkspaceHeader
        user={user}
        defaultTab={defaultTab}
        setOpeningTab={setOpeningTab}
        onExportBackup={downloadBackup}
        onRestoreBackup={restoreBackupFile}
        onLogout={signOut}
        location={TAB_LABELS[tab as keyof typeof TAB_LABELS]}
        onSearch={() => setSearchOpen(true)}
        onOpenTab={changeTab}
      />
      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        items={searchItems}
        onPick={openSearchItem}
      />
      <main>
        <WriteRecoveryNotice
          onRead={(next) => {
            setData(next);
            setUser(currentUser());
          }}
        />
        {fullPlan && (
          <FullPlanHeader
            browserFullScreen={browserFullScreen}
            toggleBrowserFullscreen={toggleBrowserFullscreen}
          />
        )}
        {error && (
          <div className="alert" role="alert">
            {error}
            <button onClick={() => setError("")}>Kapat</button>
          </div>
        )}
        <TabsPrimitive.Root
          data-slot="tabs"
          className="workspace-tabs"
          orientation="vertical"
          activationMode="manual"
          value={tab}
          onValueChange={changeTab}
        >
          <WorkspaceNavigation
            sidebarHost={sidebarHost}
            menu={workspaceMenu}
            user={user}
            tab={tab}
            mainTabsRef={mainTabsRef}
            density={density}
            setDensity={setDensity}
            setCount={setCount}
            view={view}
            setView={setView}
            openProject={() => openProject()}
            onOpenSharedCalendar={() => {
              if (isAdmin && data) setSharedCalendarOpen(true);
            }}
            reportPostingControl={
              data &&
              (isAdmin ? (
                <ActivePostingPlanningToggle
                  data={data}
                  canEdit={true}
                  saving={saving}
                  onSave={batch}
                  onError={setError}
                />
              ) : activePostingsIncluded(data) !== null ? (
                <Badge
                  tone={activePostingsIncluded(data) ? "info" : "neutral"}
                  className="report-posting-status"
                >
                  Aktif İlanlar:{" "}
                  {activePostingsIncluded(data) ? "Dahil" : "Dahil değil"}
                </Badge>
              ) : null)
            }
            pendingScenarios={
              data?.scheduleScenarios?.filter((s) => s.status === "draft")
                .length || 0
            }
            onExport={exportCurrentTab}
            dataLoaded={
              !!data && (tab !== "actual" || !!isAdmin || !!actualView.value)
            }
            hasTeams={!!teams.length}
            hasProjects={!!projects.length}
            organizationView={organizationView}
            setOrganizationView={setOrganizationView}
            reportView={reportView}
            setReportView={setReportView}
            actualLayout={actualLayout}
            setActualLayout={setActualLayout}
            actualUnit={actualUnit}
            setActualUnit={setActualUnit}
            activityUnit={activityUnit}
            setActivityUnit={setActivityUnit}
            progressView={progressView}
            progressActionsRef={setProgressActionsHost}
            setProgressView={(next) => {
              if (next === progressView || confirmProgressLeave())
                setProgressView(next);
            }}
            projectView={projectView}
            setProjectView={setProjectView}
            progressCountsRef={setProgressCountsHost}
          />
          {!data ? (
            <div className="loading">
              Kaynak planınız açılıyor…{" "}
              <button onClick={load}>Tekrar Dene</button>
            </div>
          ) : (
            // Keyed by tab: one failing screen never blanks the others.
            <ErrorBoundary key={tab} scope="section">
              {tab === "home" && (
                <TabsContent value="home">
                  <HomePage user={user} onOpen={changeTab} />
                </TabsContent>
              )}
              {tab !== "home" &&
                tab !== "resources" &&
                tab !== "progress" &&
                !(
                  tab === "projects" &&
                  ["scenario", "scenarioHistory"].includes(projectView)
                ) &&
                workspaceFilters}
              {(isAdmin || isManager) && tab === "plan" && (
                <TabsContent value="plan">
                  <PlannedAllocationPanel
                    onResetFilters={resetFilters}
                    data={data}
                    teams={teams}
                    projects={projects}
                    months={months}
                    view={view}
                    density={density}
                    todayDate={todayDate}
                    currentMonth={currentMonth}
                    labelWidth={planningLabelWidth}
                    monthWidth={planMonthWidth}
                    page={effectivePlanPage}
                    pageSize={planPageSize}
                    groups={planGroups}
                    onPageChange={setPlanPage}
                    showCapacity={showCapacity}
                    onCapacityChange={setShowCapacity}
                    capacityFilters={capacityFilters}
                    metric={metric}
                    projectIds={projectIds}
                    projectTotals={projectTotals}
                    actualTotals={actualTotals}
                    onlyDataRows={onlyDataRows}
                    onOnlyDataRowsChange={setOnlyDataRows}
                    showCompletedProjects={showCompletedPlanProjects}
                    onShowCompletedProjectsChange={(show) => {
                      setShowCompletedPlanProjects(show);
                      setCells([]);
                      setPlanMenu(null);
                    }}
                    showAllActual={showAllActual}
                    onShowAllActualChange={(show) => {
                      setShowAllActual(show);
                      setExpandedActualTeams([]);
                    }}
                    expandedActualTeams={expandedActualTeams}
                    onExpandedTeamsChange={setExpandedActualTeams}
                    currentTeamMembers={currentTeamMembers}
                    cells={cells}
                    grid={plannedGrid}
                    planTableRef={planTableRef}
                    capacityTableRef={capacityTableRef}
                    onSaveAllocation={(id, value) =>
                      save("allocation", id, value)
                    }
                    onPhaseClick={(project, month) =>
                      isAdmin
                        ? openProject(project, month)
                        : setPhaseDetail({ project, month })
                    }
                    onPhaseContextMenu={openPhaseMenu}
                  />
                </TabsContent>
              )}
              {tab === "projects" && (
                <TabsContent value="projects">
                  {["scenario", "scenarioHistory"].includes(projectView) &&
                  (isAdmin || isManager) ? (
                    <ScheduleScenarioDialog
                      historyOnly={projectView === "scenarioHistory"}
                      embedded
                      open
                      onClose={() => setProjectView("projects")}
                      data={data}
                      currentMonth={currentMonth}
                      scenarios={scenarioState.scenarios}
                      setScenarios={scenarioState.setScenarios}
                      comparedIds={scenarioState.comparedIds}
                      setComparedIds={scenarioState.setComparedIds}
                      isAdmin={!!isAdmin}
                      userId={user?.id || ""}
                      saving={saving}
                      onSaveChanges={batch}
                      onShowInReports={(id) => {
                        scenarioState.setReportScenarioId(id);
                        setReportView("resources");
                        changeTab("overview");
                      }}
                    />
                  ) : (
                    <ProjectTimelinePanel
                      onResetFilters={resetFilters}
                      selection={projectMenus.phaseGrid}
                      progress={progressBadges}
                      projects={projects}
                      revisions={data.revisions}
                      months={months}
                      weekly={timelineWeekly}
                      showCodes={showProjectCodes}
                      onCodesChange={setShowProjectCodes}
                      todayDate={todayDate}
                      labelWidth={projectLabelWidth}
                      monthWidth={projectMonthWidth}
                      density={density}
                      expandAllDetails={showProjectDetails}
                      onDetailsChange={setShowProjectDetails}
                      onWeeklyChange={setProjectWeekly}
                      isAdmin={canEditProjects}
                      saving={saving}
                      page={effectiveProjectPage}
                      onPageChange={setProjectPage}
                      actions={{
                        onReorderProject: reorderProject,
                        onProjectInfo: openProject,
                        onPhaseClick: (project, month) =>
                          canEditProjects
                            ? openProject(project, month)
                            : setPhaseDetail({ project, month }),
                        onPhaseContextMenu: openPhaseMenu,
                        onAddMilestone: openMilestone,
                        onEditMilestone: openMilestone,
                        onDeleteMilestone: deleteMilestone,
                        onReorderMilestone: reorderMilestone,
                        onMilestoneContextMenu: openMilestoneMenu,
                        onChangeMilestoneRange: changeMilestoneRange,
                        onChangeMilestoneNote: changeMilestoneNote,
                      }}
                    />
                  )}
                </TabsContent>
              )}
              {RISK_MANAGEMENT_ENABLED && tab === "risk" && (
                <TabsContent value="risk">
                  <RiskManagement
                    leaveGuardRef={riskLeaveGuard}
                    data={data}
                    user={user!}
                    onEditingChange={onRiskEditingChange}
                    onDirectoryEditingChange={setDirectoryEditing}
                    onCatalogSaved={(next, message) => {
                      setData(next);
                      setNotice(message);
                    }}
                    onReload={async () => {
                      const latest = await readLocal();
                      setData(latest);
                      setUser(currentUser());
                      return latest;
                    }}
                    onSave={(risk, revision) =>
                      batch([
                        { kind: "risk", id: risk.id, value: risk, revision },
                      ])
                    }
                    onDelete={async (risk, revision) => {
                      await batch([
                        {
                          kind: "risk",
                          id: risk.id,
                          value: null,
                          revision,
                          operation: "delete",
                        },
                      ]);
                    }}
                  />
                </TabsContent>
              )}
              {tab === "actual" && (
                <TabsContent value="actual">
                  {actualView.busy && !actualView.value && (
                    <p role="status">Gerçekleşen kaynak verileri yükleniyor…</p>
                  )}
                  {actualView.error && (
                    <p role="alert" data-actual-view-status>
                      {actualView.error}{" "}
                      <button onClick={actualView.reload}>Tekrar Dene</button>
                    </p>
                  )}
                  {isAdmin ||
                  (isManager && !!user?.leaders.length) ||
                  user?.resourceId ? (
                    <PersonAllocationPanel
                      onResetFilters={resetFilters}
                      layout={actualLayout}
                      showCompletedProjects={showCompletedActualProjects}
                      onShowCompletedProjectsChange={
                        setShowCompletedActualProjects
                      }
                      unit={actualUnit}
                      // The refresh that follows the user's own save keeps
                      // cells editable (its values are merged in already);
                      // any other refresh, e.g. after a remote change, locks
                      // the old view until it arrives.
                      loading={
                        (actualView.busy &&
                          !(
                            actualView.value && data === ownActualSave.current
                          )) ||
                        !!actualView.error
                      }
                      user={user!}
                      monthSummaries={actualView.value?.monthSummaries}
                      data={viewData || data}
                      teams={teams}
                      projects={projects}
                      months={months}
                      currentMonth={currentMonth}
                      todayDate={todayDate}
                      selectedPersonIds={personIds}
                      onlyDataRows={onlyDataRows}
                      onOnlyDataRowsChange={setOnlyDataRows}
                      canEditCalendar={!!isAdmin}
                      sharedCalendarOpen={sharedCalendarOpen && !!isAdmin}
                      onSharedCalendarClose={() => setSharedCalendarOpen(false)}
                      ownResourceId={
                        user?.role !== "admin" ? user?.resourceId : undefined
                      }
                      onSaved={(next) => {
                        ownActualSave.current = next;
                        setData(next);
                        setNotice("Gerçekleşen kişi dağılımı kaydedildi.");
                      }}
                    />
                  ) : (
                    <section className="panel access-unlinked">
                      <h2>
                        {isManager
                          ? "Liderlik Yetkisi Atanmadı"
                          : "Çalışan Kaydı Eşleştirilmedi"}
                      </h2>
                      <p>
                        {isManager
                          ? "Gerçekleşen kaynak dağılımı girebilmek için yetkili olduğunuz liderliklerin atanması gerekir."
                          : "Gerçekleşen kaynak dağılımı girebilmek için yöneticinizden kullanıcı hesabınızı çalışan kaydınızla eşleştirmesini isteyin."}
                      </p>
                    </section>
                  )}
                </TabsContent>
              )}
              {tab === "activity" && (
                <TabsContent value="activity">
                  {activity.busy && (
                    <p role="status">Aktivite raporu yükleniyor…</p>
                  )}
                  {activity.error && (
                    <div className="alert" role="alert">
                      {activity.error}{" "}
                      <button onClick={activity.reload}>Tekrar Dene</button>
                    </div>
                  )}
                  <MonthlyActivityReport
                    onResetFilters={resetFilters}
                    rows={activity.value?.rows || []}
                    teams={teams}
                    months={months}
                    todayDate={todayDate}
                    unit={activityUnit}
                    projectFiltered={projectIds.length > 0}
                  />
                </TabsContent>
              )}
              {isAdmin && tab === "resources" && (
                <TabsContent value="resources">
                  {organizationView === "teams" ? (
                    <TeamDirectory
                      data={data}
                      canEdit={!!isAdmin}
                      onEditingChange={setDirectoryEditing}
                      onSaved={(next, message) => {
                        setData(next);
                        setLeads((old) =>
                          old.filter((lead) => next.leaders?.includes(lead)),
                        );
                        setTeamIds((old) =>
                          old.filter((id) =>
                            next.teams.some((team) => team.id === id),
                          ),
                        );
                        setNotice(message);
                      }}
                    />
                  ) : (
                    <>
                      <AccessPanel
                        data={data}
                        onEditingChange={setAccountEditing}
                        onSaved={(d) => {
                          setData(d);
                          setUser(currentUser());
                        }}
                      >
                        {(access) => (
                          <ResourcesPanel
                            userId={user?.id}
                            access={access}
                            data={data}
                            start={start}
                            search={search}
                            onSearchChange={setSearch}
                            page={resourcePage}
                            onPageChange={setResourcePage}
                            resourceIds={resourceIds}
                            onSelectionChange={setResourceIds}
                            showImport={showImport}
                            onImportVisibilityChange={setShowImport}
                            saving={saving}
                            notice={notice}
                            onEdit={openResource}
                            onBulkEdit={openBulk}
                            onDelete={deleteResources}
                            onImported={(d, message) => {
                              setData(d);
                              setNotice(message);
                              setError("");
                              setResourceIds([]);
                            }}
                          />
                        )}
                      </AccessPanel>
                      <AllocationResetPanel
                        disabled={
                          saving ||
                          !Object.values(data.allocations).some((v) => v !== 0)
                        }
                        onReset={resetAll}
                      />
                      <AbsenceReport
                        data={data}
                        teamIds={ids}
                        months={months}
                        canEdit={!!isAdmin}
                        onSaved={(next) => {
                          setData(next);
                          setNotice("İzin / eğitim kayıtları güncellendi.");
                          setError("");
                        }}
                      />
                    </>
                  )}
                </TabsContent>
              )}
              {(canEditProjects || isManager) && tab === "critical" && (
                <TabsContent value="critical">
                  <ProjectInfoReport
                    projects={data.projects}
                    canEdit={canEditCriticalTopics}
                    onSave={(project) => save("project", project.id, project)}
                    onOpenProjects={() => changeTab("projects")}
                    onAddInfo={(project) => openMilestone(project)}
                    onEditInfo={(project, infoId) => {
                      const milestone = project.milestones?.find(
                        (item) => item.id === infoId,
                      );
                      if (milestone) openMilestone(project, milestone);
                    }}
                  />
                </TabsContent>
              )}
              {(isAdmin || isManager) && tab === "progress" && (
                <TabsContent value="progress">
                  <ProjectProgressPanel
                    onDraftChange={onProgressDraftChange}
                    onBeforeFilterChange={confirmProgressLeave}
                    actionsHost={progressActionsHost}
                    countsHost={progressCountsHost}
                    density={density}
                    view={progressView}
                    data={data}
                    user={user}
                    saving={saving}
                    onSave={batch}
                  />
                </TabsContent>
              )}
              {(isAdmin || isManager) && tab === "overview" && (
                <TabsContent value="overview">
                  {reportView === "headcount" ? (
                    <HeadcountReports
                      data={data}
                      teams={teams}
                      groups={leaderReportGroups}
                      date={todayDate}
                    />
                  ) : (
                    <>
                      <WorkspaceReports
                        scenarioBar={
                          <ScenarioReportBar
                            data={data}
                            scenarios={scenarioState.available}
                            activeId={scenarioState.reportScenarioId}
                            onChange={scenarioState.setReportScenarioId}
                            onEdit={() => setScenarioOpen(true)}
                            onClear={scenarioState.clearReportScenarios}
                          />
                        }
                        summaryData={data}
                        summaryCapacity={cache}
                        data={reportScenario?.data || data}
                        teams={teams}
                        months={months}
                        monthWidth={reportMonthWidth}
                        todayDate={todayDate}
                        currentMonth={currentMonth}
                        currentTeamMembers={currentTeamMembers}
                        metric={reportScenario?.metric || metric}
                        compareMetric={reportScenario ? metric : undefined}
                        leaderReportGroups={leaderReportGroups}
                        teamReportGroups={teamReportGroups}
                        capacity={reportScenario?.cache || cache}
                        actualTotals={actualTotals}
                        teamIds={ids}
                        selectedTeamIds={teamIds}
                        leads={leads}
                      />
                    </>
                  )}
                </TabsContent>
              )}
            </ErrorBoundary>
          )}
        </TabsPrimitive.Root>
      </main>
      <ProjectContextMenus
        menus={projectMenus}
        data={data}
        isAdmin={canEditProjects}
        saving={saving}
      />
      <>
        {planMenu && (
          <>
            <div
              className="phase-menu-backdrop"
              aria-hidden="true"
              onClick={() => setPlanMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setPlanMenu(null);
              }}
            />
            <div
              className="phase-menu plan-cell-menu"
              role="menu"
              aria-label="Kaynak dağılımı hücre işlemleri"
              tabIndex={-1}
              ref={planMenuRef}
              style={{ left: planMenu.x, top: planMenu.y }}
            >
              <div className="phase-menu-title">
                {monthLabel(planMenu.key.split("|")[2])} ·{" "}
                {cellSet.has(planMenu.key) ? cells.length : 1} hücre seçili
              </div>
              <button type="button" role="menuitem" onClick={copyPlanSelection}>
                <Copy size={15} />
                Değerleri Kopyala
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!copiedPlan || !planCellWritable(planMenu.key)}
                onClick={() => void pastePlanSelection()}
              >
                <ClipboardPaste size={15} />
                Değerleri Yapıştır
                {copiedPlan && (
                  <small>
                    {copiedPlan.rowCount} × {copiedPlan.columnCount}
                  </small>
                )}
              </button>
            </div>
          </>
        )}
      </>
      <Dialog
        open={!!phaseDetail}
        onOpenChange={(v) => {
          if (!v) setPhaseDetail(null);
        }}
      >
        <DialogContent className="editor phasedetail">
          <DialogHeader>
            <DialogTitle>
              {phaseDetail?.project.name}
              <ProjectResponsible project={phaseDetail?.project} />
            </DialogTitle>
            <DialogDescription>
              {phaseDetail && monthLabel(phaseDetail.month)} · Planlanan çalışma
            </DialogDescription>
          </DialogHeader>
          {phaseDetail && (
            <>
              <div
                className="phasedetailtext phase-chip phase-chip-detail"
                style={phaseChipStyle(phaseDetail.project, phaseDetail.month)}
              >
                {phaseText(phaseDetail.project, phaseDetail.month)}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {data &&
        (isAdmin || user?.role === "manager") &&
        !(
          tab === "projects" &&
          ["scenario", "scenarioHistory"].includes(projectView)
        ) && (
          <ScheduleScenarioDialog
            open={scenarioOpen}
            onClose={() => setScenarioOpen(false)}
            data={data}
            currentMonth={currentMonth}
            scenarios={scenarioState.scenarios}
            setScenarios={scenarioState.setScenarios}
            comparedIds={scenarioState.comparedIds}
            setComparedIds={scenarioState.setComparedIds}
            isAdmin={!!isAdmin}
            userId={user?.id || ""}
            saving={saving}
            onSaveChanges={batch}
            onShowInReports={(id) => {
              scenarioState.setReportScenarioId(id);
              setReportView("resources");
              changeTab("overview");
              setScenarioOpen(false);
            }}
          />
        )}
      <PortalEditorDialog
        editor={editor}
        setEditor={setEditor}
        saving={saving}
        data={data}
        setFormError={setFormError}
        leaderItems={leaderItems}
        editTeams={editTeams}
        chooseResourceStatus={chooseResourceStatus}
        resourceIds={resourceIds}
        formError={formError}
        deleteEditedMilestone={deleteEditedMilestone}
        submit={submit}
        deleteProject={deleteProject}
      />
    </div>
  );
}
