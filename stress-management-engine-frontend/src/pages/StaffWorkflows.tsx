import { useCallback, useEffect, useRef, useState } from 'react'
import { welfareApi } from '../api/welfare.api'
import { supportApi } from '../api/support.api'
import { PageHeader } from '../components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { Panel } from '../components/welfare/WelfareParts'
import type { WelfareAlert, WelfareIntervention } from '../types/welfare'
import type { SupportRequest, SupportStatus } from '../types/support'
import { getApiErrorMessage } from '../utils/apiError'

const input = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
export function StaffAlertsPage() {
  const [alerts, setAlerts] = useState<WelfareAlert[]>([])
  const [interventions, setInterventions] = useState<WelfareIntervention[]>([])
  const [loading, setLoading] = useState(true)
  const [interventionLoading, setInterventionLoading] = useState(true)
  const [error, setError] = useState('')
  const [interventionError, setInterventionError] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const interventionRequest = useRef<Promise<void> | null>(null)

  const loadInterventions = useCallback(() => {
    if (interventionRequest.current) return interventionRequest.current
    setInterventionLoading(true)
    setInterventionError('')
    let request: Promise<void>
    request = welfareApi.interventions()
      .then(result => setInterventions(result.interventions))
      .catch(e => setInterventionError(getApiErrorMessage(e, 'Intervention history could not be loaded.')))
      .finally(() => { setInterventionLoading(false); if (interventionRequest.current === request) interventionRequest.current = null })
    interventionRequest.current = request
    return request
  }, [])
  const load = useCallback(() => {
    setLoading(true)
    setError('')
    welfareApi.alerts()
      .then(result => setAlerts(result.alerts))
      .catch(e => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false))
    loadInterventions()
  }, [loadInterventions])
  useEffect(() => { load() }, [load])

  const act = async (alert: WelfareAlert, action: 'acknowledge' | 'review' | 'dismiss' | 'follow-up' | 'resolve') => {
    let payload: Record<string, unknown> = {}
    if (action === 'dismiss' || action === 'resolve') payload = { resolution_type: 'STAFF_REVIEW' }
    if (action === 'follow-up') {
      const scheduled_follow_up = window.prompt('Enter the follow-up date and time as ISO 8601 with a timezone:')
      if (!scheduled_follow_up) return
      payload = { scheduled_follow_up }
    }
    setBusy(alert.alert_id)
    setNotice('')
    try {
      await welfareApi.transition(alert.alert_id, action, payload)
      setNotice(`Alert ${action} action saved.`)
      await load()
    } catch (e) { setError(getApiErrorMessage(e, 'Alert workflow update failed.')) }
    finally { setBusy('') }
  }
  const evaluate = async (alert: WelfareAlert) => {
    setBusy(alert.alert_id)
    setError('')
    setNotice('')
    try {
      const result = await welfareApi.evaluateAlert(alert.personnel_id)
      setNotice(result.created ? 'Alert evaluation updated the workflow.' : `No new alert: ${result.decision || 'the backend policy did not qualify this observation.'}`)
      await load()
    } catch (e) { setError(getApiErrorMessage(e, 'Alert evaluation failed.')) }
    finally { setBusy('') }
  }
  const createIntervention = async (alert: WelfareAlert) => {
    const allowedActions = ['WELFARE_CHECK_IN', 'WORKLOAD_REVIEW', 'RECOVERY_DISCUSSION', 'LEAVE_PLANNING_DISCUSSION', 'COUNSELLING_REFERRAL', 'FOLLOW_UP', 'OTHER_SUPPORT']
    const action_type = window.prompt(`Choose a backend-supported intervention type:\n${allowedActions.join(', ')}`, allowedActions[0])
    if (!action_type) return
    if (!allowedActions.includes(action_type)) { setError('Choose one of the listed intervention types.'); return }
    setBusy(alert.alert_id)
    setError('')
    setNotice('')
    try {
      await welfareApi.createIntervention(alert.alert_id, { action_type })
      setNotice('Intervention recorded by the backend.')
      await loadInterventions()
    } catch (e) { setError(getApiErrorMessage(e, 'Intervention could not be created.')) }
    finally { setBusy('') }
  }
  const updateIntervention = async (item: WelfareIntervention, status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') => {
    setBusy(item.intervention_id)
    setInterventionError('')
    setNotice('')
    try {
      await welfareApi.updateIntervention(item.intervention_id, { status })
      setNotice('Intervention status was saved by the backend.')
      await loadInterventions()
    } catch (e) { setInterventionError(getApiErrorMessage(e, 'Intervention update failed.')) }
    finally { setBusy('') }
  }

  return <>
    <PageHeader eyebrow="Welfare officer" title="Welfare alerts" description="Review backend alerts and record authorized human workflow actions." />
    <div className="mb-4 flex gap-2"><button className={input} onClick={load}>Refresh workflows</button>{notice && <p role="status" className="self-center text-sm text-teal-800">{notice}</p>}</div>
    {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : alerts.length === 0 ? <EmptyState title="No welfare alerts" /> : <div className="space-y-4">{alerts.map(alert => <Panel key={alert.alert_id} title={`${alert.severity} · ${alert.status}`} description={`${alert.trigger_type} · ${alert.created_at}`}><dl className="grid gap-2 text-sm sm:grid-cols-3"><div><dt className="text-slate-500">Personnel reference</dt><dd>{alert.personnel_id}</dd></div><div><dt className="text-slate-500">Risk category</dt><dd>{alert.current_risk_category || 'Not provided'}</dd></div><div><dt className="text-slate-500">Persistence</dt><dd>{alert.persistence_reason || 'Not provided'}</dd></div></dl><div className="mt-4 flex flex-wrap gap-2"><button disabled={Boolean(busy)} className={input} onClick={() => evaluate(alert)}>Evaluate risk persistence</button>{alert.status === 'OPEN' && <button disabled={Boolean(busy)} className={input} onClick={() => act(alert, 'acknowledge')}>Acknowledge</button>}{alert.status === 'ACKNOWLEDGED' && <button disabled={Boolean(busy)} className={input} onClick={() => act(alert, 'review')}>Start review</button>}{['UNDER_REVIEW', 'ACTION_PLANNED', 'FOLLOW_UP'].includes(alert.status) && <><button disabled={Boolean(busy)} className={input} onClick={() => createIntervention(alert)}>Record intervention</button>{alert.status === 'ACTION_PLANNED' && <button disabled={Boolean(busy)} className={input} onClick={() => act(alert, 'follow-up')}>Schedule follow-up</button>}{['ACTION_PLANNED', 'FOLLOW_UP'].includes(alert.status) && <button disabled={Boolean(busy)} className={input} onClick={() => act(alert, 'resolve')}>Resolve</button>}</>}{!['ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'].includes(alert.status) && <button disabled={Boolean(busy)} className="rounded-lg border border-rose-300 px-3 py-2 text-sm text-rose-800" onClick={() => { if (window.confirm('Dismiss this alert after review?')) void act(alert, 'dismiss') }}>Dismiss</button>}</div></Panel>)}</div>}
    <Panel title="Intervention history" description="Persisted interventions returned by the authorized backend. Status changes are saved and reloaded from the service.">
      {interventionLoading ? <LoadingState label="Loading intervention history" /> : interventionError ? <ErrorState message={interventionError} onRetry={loadInterventions} /> : interventions.length === 0 ? <EmptyState title="No interventions recorded" /> : <div className="space-y-3">{interventions.map(item => <div key={item.intervention_id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{item.action_type.replace(/_/g, ' ')}</p><p className="mt-1 text-sm text-slate-600">{item.status.replace(/_/g, ' ')} · {item.created_at}</p></div><div className="flex flex-wrap gap-2">{(['IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const).map(status => <button key={status} disabled={Boolean(busy) || item.status === status} className={input} onClick={() => void updateIntervention(item, status)}>{status.replace(/_/g, ' ')}</button>)}</div></div><dl className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3"><div><dt>Personnel reference</dt><dd>{item.personnel_id}</dd></div><div><dt>Alert reference</dt><dd>{item.alert_id}</dd></div><div><dt>Scheduled follow-up</dt><dd>{item.scheduled_follow_up || 'Not scheduled'}</dd></div></dl>{item.completed_at && <p className="mt-2 text-xs text-slate-500">Completed {item.completed_at}</p>}{item.outcome_category && <p className="mt-1 text-xs text-slate-500">Outcome: {item.outcome_category}</p>}</div>)}</div>}
    </Panel>
  </>
}
export function SupportQueuePage() {
  const [items, setItems] = useState<SupportRequest[]>([])
  const [status, setStatus] = useState<SupportStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(() => { setLoading(true); setError(''); supportApi.queue(status || undefined).then(r => setItems(r.requests)).catch(e => setError(getApiErrorMessage(e))).finally(() => setLoading(false)) }, [status])
  useEffect(() => { load() }, [load])
  const transition = async (item: SupportRequest, action: 'acknowledge' | 'schedule' | 'start' | 'resolve') => {
    setBusy(item.support_request_id); setError(''); setNotice('')
    try {
      if (action === 'schedule') {
        const value = window.prompt('Follow-up date/time (ISO 8601 with timezone):', new Date(Date.now() + 7 * 86400000).toISOString())
        if (!value) return
        await supportApi.schedule(item.support_request_id, value)
      } else if (action === 'acknowledge') await supportApi.acknowledge(item.support_request_id)
      else if (action === 'start') await supportApi.start(item.support_request_id)
      else { if (!window.confirm('Resolve this support request?')) return; await supportApi.resolve(item.support_request_id) }
      setNotice('Support request status was updated by the backend.'); await load()
    } catch (e) { setError(getApiErrorMessage(e, 'Support request workflow failed.')) }
    finally { setBusy('') }
  }
  return <><PageHeader eyebrow="Welfare officer" title="Support request queue" description="Review personnel initiated requests and update status through the authorized backend workflow." /><div className="mb-4 flex flex-wrap items-center gap-3"><label className="text-sm">Filter status <select className={input} value={status} onChange={e => setStatus(e.target.value as SupportStatus | '')}><option value="">All statuses</option>{['REQUESTED', 'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'RESOLVED'].map(s => <option key={s}>{s}</option>)}</select></label><button className={input} onClick={load}>Refresh</button>{notice && <p role="status" className="text-sm text-teal-800">{notice}</p>}</div>{loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : items.length === 0 ? <EmptyState title="No matching support requests" /> : <div className="space-y-3">{items.map(item => <Panel key={item.support_request_id} title={`${item.category} · ${item.status}`} description={`${item.urgency} · ${item.created_at}`}><p className="text-sm leading-6 text-slate-700">{item.message || 'No message provided.'}</p><dl className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3"><div><dt>Personnel reference</dt><dd>{item.personnel_id}</dd></div><div><dt>Request ID</dt><dd>{item.support_request_id}</dd></div><div><dt>Follow-up</dt><dd>{item.scheduled_follow_up || 'Not scheduled'}</dd></div></dl><div className="mt-3 flex flex-wrap gap-2">{item.status === 'REQUESTED' && <button disabled={Boolean(busy)} className={input} onClick={() => transition(item, 'acknowledge')}>Acknowledge</button>}{item.status !== 'RESOLVED' && <><button disabled={Boolean(busy)} className={input} onClick={() => transition(item, 'schedule')}>Schedule follow-up</button>{item.status !== 'IN_PROGRESS' && <button disabled={Boolean(busy)} className={input} onClick={() => transition(item, 'start')}>Start follow-up</button>}<button disabled={Boolean(busy)} className="rounded-lg border border-rose-300 px-3 py-2 text-sm text-rose-800" onClick={() => transition(item, 'resolve')}>Resolve</button></>}</div></Panel>)}</div>}</>
}
