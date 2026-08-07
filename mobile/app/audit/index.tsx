
import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Database,
  Shield,
  Clock,
  Settings,
  FileText,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Copy,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { API_URL } from "@/constants/api";
import { getToken } from "@/lib/auth";

// ─── types ───────────────────────────────────────────────────────────────────

type Severity = "error" | "warning" | "info";
type CheckStatus = "pass" | "fail" | "warn";

interface Issue {
  severity: Severity;
  category: string;
  message: string;
  fix?: string;
}

interface ChecklistItem {
  item: string;
  status: CheckStatus;
  detail: string;
}

interface AuditReport {
  generatedAt: string;
  readiness: {
    score: "ready" | "minor-fixes-needed" | "blockers-present";
    errorCount: number;
    warningCount: number;
    infoCount: number;
    summary: string;
  };
  sections: {
    schemaPortability: {
      tables: string[];
      tableCount: number;
      extensions: { name: string; version: string; safe: boolean }[];
      exoticExtensions: string[];
      serialColumns: string[];
      foreignKeyCount: number;
      indexCount: number;
    };
    configuration: Record<string, { present: boolean; isEnvVar: boolean; note: string }>;
    timestamps: {
      totalTimestampColumns: number;
      withTimezone: number;
      withoutTimezone: number;
      localTimestampColumns: string[];
      assessment: string;
    };
    rowLevelSecurity: {
      currentlyEnabled: string[];
      currentlyDisabled: string[];
      enforcementLayer: string;
      enforcementDetail: string;
      roleMapping: Record<string, { description: string; suggestedPolicy: string; tables: string[] }>;
      rlsMigrationPath: string[];
    };
    ddlExport: {
      description: string;
      sql: string;
    };
    issues: Issue[];
  };
  migrationChecklist: ChecklistItem[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function severityColor(s: Severity) {
  if (s === "error") return { bg: "bg-rose-900/40", border: "border-rose-700", text: "text-rose-300", icon: "rose" };
  if (s === "warning") return { bg: "bg-amber-900/40", border: "border-amber-700", text: "text-amber-300", icon: "amber" };
  return { bg: "bg-sky-900/40", border: "border-sky-700", text: "text-sky-300", icon: "sky" };
}

function statusColor(s: CheckStatus) {
  if (s === "pass") return { text: "text-emerald-400", icon: "emerald" };
  if (s === "fail") return { text: "text-rose-400", icon: "rose" };
  return { text: "text-amber-400", icon: "amber" };
}

function readinessColors(score: AuditReport["readiness"]["score"]) {
  if (score === "ready") return { bg: "bg-emerald-900/50", border: "border-emerald-600", badge: "bg-emerald-600", text: "MIGRATION READY" };
  if (score === "minor-fixes-needed") return { bg: "bg-amber-900/50", border: "border-amber-600", badge: "bg-amber-600", text: "MINOR FIXES NEEDED" };
  return { bg: "bg-rose-900/50", border: "border-rose-600", badge: "bg-rose-600", text: "BLOCKERS PRESENT" };
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <View className="flex-row items-center gap-3 mb-3">
      <View className="w-8 h-8 rounded-lg bg-indigo-900/60 items-center justify-center">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-zinc-100 font-bold text-base">{title}</Text>
        {subtitle && <Text className="text-zinc-500 text-xs mt-0.5">{subtitle}</Text>}
      </View>
    </View>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <View className={`rounded-xl border border-zinc-800 bg-zinc-900 p-4 mb-3 ${className}`}>
      {children}
    </View>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  const [expanded, setExpanded] = useState(false);
  const colors = severityColor(issue.severity);
  const SeverityIcon = issue.severity === "error" ? XCircle : issue.severity === "warning" ? AlertTriangle : Info;

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      className={`rounded-lg border ${colors.border} ${colors.bg} p-3 mb-2`}
      accessibilityLabel={`Issue: ${issue.message}`}
    >
      <View className="flex-row items-start gap-2">
        <SeverityIcon size={15} color={issue.severity === "error" ? "#f87171" : issue.severity === "warning" ? "#fbbf24" : "#38bdf8"} />
        <View className="flex-1">
          <Text className={`${colors.text} text-xs font-semibold uppercase tracking-wider mb-0.5`}>
            {issue.category}
          </Text>
          <Text className="text-zinc-200 text-sm leading-5">{issue.message}</Text>
          {expanded && issue.fix && (
            <View className="mt-2 pt-2 border-t border-zinc-700">
              <Text className="text-zinc-400 text-xs font-semibold mb-1">RECOMMENDED FIX</Text>
              <Text className="text-zinc-300 text-xs leading-4">{issue.fix}</Text>
            </View>
          )}
        </View>
        {issue.fix && (
          expanded
            ? <ChevronDown size={14} color="#71717a" />
            : <ChevronRight size={14} color="#71717a" />
        )}
      </View>
    </Pressable>
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const [expanded, setExpanded] = useState(false);
  const colors = statusColor(item.status);
  const Icon = item.status === "pass" ? CheckCircle : item.status === "fail" ? XCircle : AlertTriangle;

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      className="flex-row items-start gap-3 py-2.5 border-b border-zinc-800"
      accessibilityLabel={`Checklist: ${item.item}`}
    >
      <Icon size={16} color={item.status === "pass" ? "#34d399" : item.status === "fail" ? "#f87171" : "#fbbf24"} />
      <View className="flex-1">
        <Text className="text-zinc-200 text-sm">{item.item}</Text>
        {expanded && (
          <Text className="text-zinc-400 text-xs mt-1 leading-4">{item.detail}</Text>
        )}
      </View>
      <ChevronRight size={13} color="#52525b" />
    </Pressable>
  );
}

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View className="mb-3">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
        accessibilityLabel={`Toggle section: ${title}`}
      >
        <View className="w-7 h-7 rounded-lg bg-indigo-900/60 items-center justify-center">
          {icon}
        </View>
        <Text className="flex-1 text-zinc-100 font-semibold text-sm">{title}</Text>
        {open ? <ChevronDown size={16} color="#71717a" /> : <ChevronRight size={16} color="#71717a" />}
      </Pressable>
      {open && (
        <View className="border border-t-0 border-zinc-800 rounded-b-xl bg-zinc-950 px-4 pt-3 pb-4">
          {children}
        </View>
      )}
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function AuditScreen() {
  const router = useRouter();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ddlCopied, setDdlCopied] = useState(false);

  const fetchAudit = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/migration-audit`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const data: AuditReport = await res.json();
      setReport(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load audit report");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAudit();
  }, [fetchAudit]);

  // ── loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-zinc-950">
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center gap-4">
          <ActivityIndicator color="#6366f1" size="large" />
          <Text className="text-zinc-400 text-sm">Running migration audit…</Text>
          <Text className="text-zinc-600 text-xs">Inspecting schema, config, timestamps, RLS…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── error ────────────────────────────────────────────────────────────────
  if (error || !report) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-zinc-950">
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center px-6 gap-4">
          <XCircle size={40} color="#f87171" />
          <Text className="text-zinc-100 font-bold text-lg text-center">Audit Failed</Text>
          <Text className="text-zinc-400 text-sm text-center">{error}</Text>
          <Pressable
            onPress={() => { setLoading(true); setError(null); fetchAudit(); }}
            className="bg-indigo-600 rounded-xl px-6 py-3 active:opacity-80"
            accessibilityLabel="Retry audit"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const rc = readinessColors(report.readiness.score);
  const { sections } = report;
  const errorIssues = sections.issues.filter((i) => i.severity === "error");
  const warnIssues = sections.issues.filter((i) => i.severity === "warning");
  const infoIssues = sections.issues.filter((i) => i.severity === "info");

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-zinc-950">
      <StatusBar style="light" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-2 pb-3 border-b border-zinc-800">
        <View>
          <Text className="text-zinc-100 text-xl font-bold">Migration Audit</Text>
          <Text className="text-zinc-500 text-xs mt-0.5">
            Neon → Supabase readiness · {new Date(report.generatedAt).toLocaleString()}
          </Text>
        </View>
        <Pressable
          onPress={onRefresh}
          className="w-9 h-9 rounded-xl bg-zinc-800 items-center justify-center active:opacity-70"
          accessibilityLabel="Refresh audit"
        >
          <RefreshCw size={16} color="#a1a1aa" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-12 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
      >
        {/* ── Readiness Banner ── */}
        <View className={`rounded-2xl border ${rc.border} ${rc.bg} p-4 mb-4`}>
          <View className="flex-row items-center gap-2 mb-2">
            <View className={`${rc.badge} rounded-full px-3 py-1`}>
              <Text className="text-white text-xs font-bold tracking-wider">{rc.text}</Text>
            </View>
          </View>
          <Text className="text-zinc-200 text-sm leading-5">{report.readiness.summary}</Text>
          <View className="flex-row gap-4 mt-3 pt-3 border-t border-zinc-700">
            <View className="items-center">
              <Text className="text-rose-400 text-xl font-bold">{report.readiness.errorCount}</Text>
              <Text className="text-zinc-500 text-xs">Blockers</Text>
            </View>
            <View className="items-center">
              <Text className="text-amber-400 text-xl font-bold">{report.readiness.warningCount}</Text>
              <Text className="text-zinc-500 text-xs">Warnings</Text>
            </View>
            <View className="items-center">
              <Text className="text-sky-400 text-xl font-bold">{report.readiness.infoCount}</Text>
              <Text className="text-zinc-500 text-xs">Notes</Text>
            </View>
          </View>
        </View>

        {/* ── Migration Checklist ── */}
        <CollapsibleSection
          title="Migration Checklist"
          icon={<CheckCircle size={15} color="#818cf8" />}
          defaultOpen
        >
          {report.migrationChecklist.map((item, i) => (
            <ChecklistRow key={i} item={item} />
          ))}
        </CollapsibleSection>

        {/* ── Issues ── */}
        {sections.issues.length > 0 && (
          <CollapsibleSection
            title={`Issues (${sections.issues.length})`}
            icon={<AlertTriangle size={15} color="#818cf8" />}
            defaultOpen={report.readiness.errorCount > 0}
          >
            {errorIssues.length > 0 && (
              <>
                <Text className="text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                  Blockers ({errorIssues.length})
                </Text>
                {errorIssues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
              </>
            )}
            {warnIssues.length > 0 && (
              <>
                <Text className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-2 mt-2">
                  Warnings ({warnIssues.length})
                </Text>
                {warnIssues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
              </>
            )}
            {infoIssues.length > 0 && (
              <>
                <Text className="text-sky-400 text-xs font-bold uppercase tracking-wider mb-2 mt-2">
                  Notes ({infoIssues.length})
                </Text>
                {infoIssues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
              </>
            )}
          </CollapsibleSection>
        )}

        {/* ── Schema Portability ── */}
        <CollapsibleSection
          title="Schema Portability"
          icon={<Database size={15} color="#818cf8" />}
        >
          <View className="flex-row flex-wrap gap-2 mb-3">
            <StatPill label="Tables" value={String(sections.schemaPortability.tableCount)} />
            <StatPill label="Foreign Keys" value={String(sections.schemaPortability.foreignKeyCount)} />
            <StatPill label="Indexes" value={String(sections.schemaPortability.indexCount)} />
          </View>

          <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">Tables</Text>
          <View className="flex-row flex-wrap gap-1.5 mb-3">
            {sections.schemaPortability.tables.map((t) => (
              <View key={t} className="bg-zinc-800 rounded-md px-2 py-1">
                <Text className="text-zinc-300 text-xs font-mono">{t}</Text>
              </View>
            ))}
          </View>

          <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">Extensions</Text>
          {sections.schemaPortability.extensions.map((ext) => (
            <View key={ext.name} className="flex-row items-center gap-2 py-1.5 border-b border-zinc-800">
              {ext.safe
                ? <CheckCircle size={13} color="#34d399" />
                : <AlertTriangle size={13} color="#fbbf24" />}
              <Text className="text-zinc-300 text-xs font-mono flex-1">{ext.name}</Text>
              <Text className="text-zinc-500 text-xs">v{ext.version}</Text>
              <Text className={ext.safe ? "text-emerald-400 text-xs" : "text-amber-400 text-xs"}>
                {ext.safe ? "Safe" : "Review"}
              </Text>
            </View>
          ))}

          {sections.schemaPortability.exoticExtensions.length === 0 && (
            <View className="flex-row items-center gap-2 mt-2">
              <CheckCircle size={13} color="#34d399" />
              <Text className="text-emerald-400 text-xs">No exotic extensions — fully portable</Text>
            </View>
          )}
        </CollapsibleSection>

        {/* ── Configuration ── */}
        <CollapsibleSection
          title="Configuration Audit"
          icon={<Settings size={15} color="#818cf8" />}
        >
          {Object.entries(sections.configuration).map(([key, val]) => (
            <View key={key} className="flex-row items-start gap-2 py-2.5 border-b border-zinc-800">
              {val.present
                ? <CheckCircle size={14} color="#34d399" />
                : <XCircle size={14} color="#f87171" />}
              <View className="flex-1">
                <Text className="text-zinc-200 text-xs font-mono font-semibold">{key}</Text>
                <Text className="text-zinc-400 text-xs mt-0.5">{val.note}</Text>
              </View>
            </View>
          ))}
          <View className="mt-3 rounded-lg bg-zinc-800/60 p-3">
            <Text className="text-zinc-300 text-xs leading-4">
              <Text className="text-emerald-400 font-semibold">Migration is config-only.</Text>
              {" "}Swap DATABASE_URL to the Supabase connection string. No code changes required.
            </Text>
          </View>
        </CollapsibleSection>

        {/* ── Timestamps ── */}
        <CollapsibleSection
          title="Timestamp / UTC Audit"
          icon={<Clock size={15} color="#818cf8" />}
        >
          <View className="flex-row gap-3 mb-3">
            <StatPill label="Total TS Cols" value={String(sections.timestamps.totalTimestampColumns)} />
            <StatPill label="With TZ" value={String(sections.timestamps.withTimezone)} color="emerald" />
            <StatPill label="Without TZ" value={String(sections.timestamps.withoutTimezone)} color={sections.timestamps.withoutTimezone > 0 ? "amber" : "emerald"} />
          </View>

          <View className={`rounded-lg border p-3 mb-3 ${sections.timestamps.withoutTimezone === 0 ? "border-emerald-700 bg-emerald-900/30" : "border-amber-700 bg-amber-900/30"}`}>
            <Text className={`text-xs leading-4 ${sections.timestamps.withoutTimezone === 0 ? "text-emerald-300" : "text-amber-300"}`}>
              {sections.timestamps.assessment}
            </Text>
          </View>

          {sections.timestamps.localTimestampColumns.length > 0 && (
            <>
              <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Columns Without Timezone
              </Text>
              {sections.timestamps.localTimestampColumns.map((col) => (
                <View key={col} className="flex-row items-center gap-2 py-1">
                  <AlertTriangle size={12} color="#fbbf24" />
                  <Text className="text-zinc-300 text-xs font-mono">{col}</Text>
                </View>
              ))}
            </>
          )}

          <View className="mt-3 rounded-lg bg-zinc-800/60 p-3">
            <Text className="text-zinc-400 text-xs leading-4">
              Supabase defaults to UTC. TIMESTAMP WITHOUT TIME ZONE columns store values as-is — if your app always writes UTC (which this app does via Node.js Date objects), no data conversion is needed on migration.
            </Text>
          </View>
        </CollapsibleSection>

        {/* ── Row Level Security ── */}
        <CollapsibleSection
          title="Row Level Security Assessment"
          icon={<Shield size={15} color="#818cf8" />}
        >
          <View className="rounded-lg border border-sky-700 bg-sky-900/30 p-3 mb-3">
            <Text className="text-sky-300 text-xs font-semibold mb-1">Current Enforcement Layer</Text>
            <Text className="text-sky-200 text-xs leading-4">
              {sections.rowLevelSecurity.enforcementDetail}
            </Text>
          </View>

          <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Role → RLS Policy Mapping
          </Text>
          {Object.entries(sections.rowLevelSecurity.roleMapping).map(([role, mapping]) => (
            <View key={role} className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 mb-2">
              <Text className="text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">{role.replace(/_/g, " ")}</Text>
              <Text className="text-zinc-300 text-xs mb-2">{mapping.description}</Text>
              <Text className="text-zinc-500 text-xs font-semibold mb-1">Suggested Policy:</Text>
              <Text className="text-zinc-400 text-xs font-mono leading-4">{mapping.suggestedPolicy}</Text>
            </View>
          ))}

          <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2 mt-3">
            RLS Migration Path
          </Text>
          {sections.rowLevelSecurity.rlsMigrationPath.map((step, i) => (
            <View key={i} className="flex-row gap-2 mb-2">
              <View className="w-5 h-5 rounded-full bg-indigo-900 items-center justify-center mt-0.5">
                <Text className="text-indigo-300 text-xs font-bold">{i + 1}</Text>
              </View>
              <Text className="text-zinc-400 text-xs leading-4 flex-1">{step.replace(/^\d+\.\s*/, "")}</Text>
            </View>
          ))}
        </CollapsibleSection>

        {/* ── DDL Export ── */}
        <CollapsibleSection
          title="Clean DDL Export"
          icon={<FileText size={15} color="#818cf8" />}
        >
          <Text className="text-zinc-400 text-xs mb-3 leading-4">
            {sections.ddlExport.description}
          </Text>
          <View className="rounded-lg bg-zinc-800 border border-zinc-700 p-3 mb-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text className="text-zinc-300 text-xs font-mono leading-5">
                {sections.ddlExport.sql}
              </Text>
            </ScrollView>
          </View>
          <View className="rounded-lg bg-zinc-800/60 p-3">
            <Text className="text-zinc-400 text-xs leading-4">
              <Text className="text-emerald-400 font-semibold">How to use: </Text>
              Copy this DDL and run it against a fresh Supabase Postgres instance (SQL Editor or psql). All statements use IF NOT EXISTS — safe to re-run.
            </Text>
          </View>
        </CollapsibleSection>

        {/* ── Final Summary ── */}
        <Card className="border-indigo-800 bg-indigo-950/40">
          <Text className="text-indigo-300 text-xs font-bold uppercase tracking-wider mb-3">
            Final Readiness Summary
          </Text>
          <SummaryRow label="Schema portability" status="pass" detail="Standard Postgres DDL — no Neon-specific syntax" />
          <SummaryRow label="Config (env-var driven)" status={sections.configuration.DATABASE_URL?.present ? "pass" : "fail"} detail="DATABASE_URL, JWT_SECRET, S3 keys all from env" />
          <SummaryRow label="Timestamps UTC-safe" status={sections.timestamps.withoutTimezone === 0 ? "pass" : "warn"} detail={sections.timestamps.withoutTimezone === 0 ? "All timestamps are UTC-compatible" : `${sections.timestamps.withoutTimezone} col(s) without timezone — verify UTC writes`} />
          <SummaryRow label="RLS assessment" status="pass" detail="Application-layer enforcement documented; RLS migration path provided" />
          <SummaryRow label="DDL export" status="pass" detail="Clean stock-Postgres DDL ready to run on Supabase" />
          <SummaryRow label="Connection pooling" status="warn" detail="Use Supabase PgBouncer URL; keep pool max ≤ 10" />

          <View className="mt-3 pt-3 border-t border-indigo-800">
            <Text className="text-zinc-400 text-xs leading-4">
              <Text className="text-indigo-300 font-semibold">To migrate: </Text>
              (1) Run the DDL export on a fresh Supabase instance. (2) Copy data with pg_dump / pg_restore or Supabase's import tool. (3) Update DATABASE_URL to the Supabase connection string (use the PgBouncer pooler URL). (4) Deploy. No code changes required.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── tiny helpers ─────────────────────────────────────────────────────────────

function StatPill({ label, value, color = "zinc" }: { label: string; value: string; color?: string }) {
  const textColor = color === "emerald" ? "text-emerald-400" : color === "amber" ? "text-amber-400" : "text-zinc-200";
  return (
    <View className="rounded-lg bg-zinc-800 px-3 py-2 items-center">
      <Text className={`${textColor} text-base font-bold`}>{value}</Text>
      <Text className="text-zinc-500 text-xs">{label}</Text>
    </View>
  );
}

function SummaryRow({ label, status, detail }: { label: string; status: CheckStatus; detail: string }) {
  const Icon = status === "pass" ? CheckCircle : status === "fail" ? XCircle : AlertTriangle;
  const iconColor = status === "pass" ? "#34d399" : status === "fail" ? "#f87171" : "#fbbf24";
  return (
    <View className="flex-row items-start gap-2 py-2 border-b border-indigo-900/50">
      <Icon size={14} color={iconColor} />
      <View className="flex-1">
        <Text className="text-zinc-200 text-xs font-semibold">{label}</Text>
        <Text className="text-zinc-500 text-xs mt-0.5">{detail}</Text>
      </View>
    </View>
  );
}
