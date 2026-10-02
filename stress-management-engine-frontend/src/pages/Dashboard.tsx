import { Activity, Clock3, ClipboardList } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { operationalApi } from '../api/operational.api'
import { PageHeader } from '../components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { MetricCard } from '../components/common/MetricCard'
import { Panel } from '../components/welfare/WelfareParts'
import type { OperationalSummary } from '../types/operational'
import { getApiErrorMessage } from '../utils/apiError'

export function Dashboard() {
  const [summary, setSummary] = useState<OperationalSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(() => { setLoading(true); setError(''); operationalApi.summary().then(setSummary).catch(e => setError(getApiErrorMessage(e, 'Authorized operational summary is unavailable.'))).finally(() => setLoading(false)) }, [])
  useEffect(() => { load() }, [load])
  const domains = summary ? Object.entries(summary.domains) : []
  const total = domains.reduce((sum, [, value]) => sum + value.record_count, 0)
  return <><PageHeader eyebrow="Commander" title="Operational overview" description="Aggregate record counts returned by the backend for the authorized time period. This view does not expose individual welfare cases." />{loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : summary && <><div className="mb-5 grid gap-4 sm:grid-cols-2"><MetricCard label="Operational records" value={String(total)} icon={ClipboardList} /><MetricCard label="Domains with returned records" value={String(domains.filter(([, value]) => value.record_count > 0).length)} icon={Activity} /></div><Panel title="Operational snapshot" description={`${summary.start_date} to ${summary.end_date}`}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{domains.map(([domain, data]) => <div key={domain} className="rounded-lg border border-slate-200 p-4"><p className="text-sm font-medium capitalize text-slate-700">{domain.replace(/_/g, ' ')}</p><p className="mt-2 text-2xl font-semibold">{data.record_count}</p>{data.average_duty_hours !== undefined && <p className="mt-1 text-xs text-slate-500">Average duty hours: {data.average_duty_hours}</p>}{data.night_duty_records !== undefined && <p className="mt-1 text-xs text-slate-500">Night duty records: {data.night_duty_records}</p>}{data.average_workload_score !== undefined && <p className="mt-1 text-xs text-slate-500">Average workload: {data.average_workload_score}</p>}</div>)}</div>{domains.length === 0 && <EmptyState title="No operational records in this period" />}</Panel><p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4" />Summary window: {summary.start_date} through {summary.end_date}</p></>}</>
}
