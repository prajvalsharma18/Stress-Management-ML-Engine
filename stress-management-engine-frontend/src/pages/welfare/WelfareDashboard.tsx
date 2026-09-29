import { BellRing, ClipboardCheck, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { personnelApi } from '../../api/personnel.api'
import { welfareApi } from '../../api/welfare.api'
import { PageHeader } from '../../components/common/PageHeader'
import { MetricCard } from '../../components/common/MetricCard'
import { ErrorState, LoadingState } from '../../components/common/States'
import { Panel, PersonnelLinks } from '../../components/welfare/WelfareParts'
import type { PersonnelDirectoryItem } from '../../types/personnel'
import type { WelfareDashboardSummary } from '../../types/operational'
import { getApiErrorMessage } from '../../utils/apiError'

export function WelfareDashboard() {
  const [summary, setSummary] = useState<WelfareDashboardSummary | null>(null)
  const [personnel, setPersonnel] = useState<PersonnelDirectoryItem[]>([])
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const load = useCallback(() => {
    setState('loading')
    Promise.all([
      welfareApi.dashboardSummary(),
      personnelApi.directory({ page: 1, page_size: 25 }),
    ]).then(([dashboard, directory]) => {
      setSummary(dashboard)
      setPersonnel(directory.items)
      setState('success')
    }).catch(error => {
      setMessage(getApiErrorMessage(error, 'Welfare dashboard information is unavailable right now.'))
      setState('error')
    })
  }, [])
  useEffect(() => { load() }, [load])

  return <>
    <PageHeader eyebrow="Welfare officer" title="Welfare operations dashboard" description="A privacy-preserving view of backend-supported welfare signals and workflow activity." />
    {state === 'loading' && <LoadingState label="Loading welfare dashboard" />}
    {state === 'error' && <ErrorState message={message} onRetry={load} />}
    {state === 'success' && summary && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Authorized personnel" value={String(summary.personnel.total_authorized)} icon={UsersRound} />
        <MetricCard label="High risk" value={String(summary.risk.HIGH)} icon={ClipboardCheck} />
        <MetricCard label="Open welfare alerts" value={String(summary.alerts.open)} icon={BellRing} />
        <MetricCard label="Interventions needing follow-up" value={String(summary.interventions.follow_up)} icon={ClipboardCheck} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_0.55fr]">
        <Panel title="Personnel monitoring" description="Personnel references come from the authorized welfare directory.">
          <PersonnelLinks personnel={personnel} />
        </Panel>
        <Panel title="Welfare overview" description={`Summary generated ${new Date(summary.generated_at).toLocaleString()}`}>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Low risk</dt><dd className="font-semibold">{summary.risk.LOW}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Elevated risk</dt><dd className="font-semibold">{summary.risk.ELEVATED}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Attention alerts</dt><dd className="font-semibold">{summary.alerts.attention}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Priority alerts</dt><dd className="font-semibold">{summary.alerts.priority}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Active interventions</dt><dd className="font-semibold">{summary.interventions.active}</dd></div>
          </dl>
        </Panel>
      </div>
    </>}
  </>
}
