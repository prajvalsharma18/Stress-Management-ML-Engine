import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { consentApi } from '../api/consent.api'
import { reportApi } from '../api/report.api'
import { riskApi } from '../api/risk.api'
import { supportApi } from '../api/support.api'
import { wellnessApi } from '../api/wellness.api'
import { welfareApi } from '../api/welfare.api'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { Panel } from '../components/welfare/WelfareParts'
import type { ConsentListResponse, ConsentType } from '../types/consent'
import type { RiskExplanationResponse, RiskHistoryResponse, RiskPredictionResponse } from '../types/risk'
import type { SupportRequest, SupportCategory, SupportUrgency } from '../types/support'
import type { WellnessAssessment, WellnessPayload } from '../types/wellness'
import type { WelfareAlert, WelfareRecommendation } from '../types/welfare'
import { getApiErrorMessage } from '../utils/apiError'

const consentTypes: ConsentType[] = ['WELLNESS_DATA_PROCESSING', 'BIOMETRIC_DATA_PROCESSING', 'RECOMMENDATION_PROCESSING', 'DATA_SHARING']
type Loadable<T> = { loading: boolean; error?: string; value?: T }
const field = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'

export function PersonnelWorkspace() {
  const { user } = useAuth()
  const id = user?.personnel_id
  const [risk, setRisk] = useState<Loadable<RiskPredictionResponse>>({ loading: true })
  const [explanation, setExplanation] = useState<Loadable<RiskExplanationResponse>>({ loading: true })
  const [history, setHistory] = useState<Loadable<RiskHistoryResponse>>({ loading: true })
  const [consent, setConsent] = useState<Loadable<ConsentListResponse>>({ loading: true })
  const [wellness, setWellness] = useState<Loadable<WellnessAssessment[]>>({ loading: true })
  const [alerts, setAlerts] = useState<Loadable<WelfareAlert[]>>({ loading: true })
  const [recommendations, setRecommendations] = useState<Loadable<WelfareRecommendation[]>>({ loading: true })
  const [requests, setRequests] = useState<Loadable<SupportRequest[]>>({ loading: true })
  const [busyConsent, setBusyConsent] = useState<ConsentType | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const [wellnessError, setWellnessError] = useState('')
  const [requestError, setRequestError] = useState('')
  const [notice, setNotice] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  const [deletingAssessmentId, setDeletingAssessmentId] = useState<string | null>(null)
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null)
  const [assessmentDetail, setAssessmentDetail] = useState<Loadable<WellnessAssessment>>({ loading: false })
  const wellnessSequence = useRef(0)
  const wellnessRequest = useRef<Promise<boolean> | null>(null)
  const assessmentSequence = useRef(0)
  const wellnessMutation = useRef(false)
  const [payload, setPayload] = useState<WellnessPayload>({ assessment_date: new Date().toISOString().slice(0, 10), sleep_quality: 3, fatigue_level: 3, perceived_stress: 3, mood_wellbeing: 3 })
  const [support, setSupport] = useState<{ category: SupportCategory; urgency: SupportUrgency; message: string; related_alert_id: string }>({ category: 'GENERAL_WELFARE', urgency: 'NORMAL', message: '', related_alert_id: '' })

  const refreshWellness = useCallback(async () => {
    if (wellnessRequest.current) return wellnessRequest.current
    const sequence = ++wellnessSequence.current
    setWellness(current => ({ ...current, loading: true, error: undefined }))
    let request!: Promise<boolean>
    request = (async () => {
      try {
        const result = await wellnessApi.listMine()
        if (sequence === wellnessSequence.current) setWellness({ loading: false, value: result.assessments })
        return true
      } catch (error) {
        if (sequence === wellnessSequence.current) {
          setWellness(current => ({ loading: false, value: axios.isAxiosError(error) && error.response?.status === 403 ? undefined : current.value, error: getApiErrorMessage(error) }))
        }
        return false
      } finally {
        if (wellnessRequest.current === request) wellnessRequest.current = null
      }
    })()
    wellnessRequest.current = request
    return request
  }, [])
  const load = useCallback(() => {
    if (!id) return
    const read = <T,>(promise: Promise<T>, set: (v: Loadable<T>) => void) => {
      set({ loading: true })
      promise.then(value => set({ loading: false, value })).catch(error => set({ loading: false, error: getApiErrorMessage(error) }))
    }
    read(riskApi.prediction(id), setRisk)
    read(riskApi.explanation(id), setExplanation)
    read(riskApi.history(id, { page: 1, page_size: 10 }), setHistory)
    read(consentApi.getMine(), setConsent)
    void refreshWellness()
    read(welfareApi.personnelAlerts(id).then(result => result.alerts), setAlerts)
    read(welfareApi.recommendations(id).then(result => result.recommendations), setRecommendations)
    read(supportApi.mine().then(result => result.requests), setRequests)
  }, [id, refreshWellness])
  useEffect(() => { load() }, [load])

  const openAssessment = async (assessmentId: string) => {
    const sequence = ++assessmentSequence.current
    setSelectedAssessmentId(assessmentId)
    setAssessmentDetail({ loading: true })
    try {
      const value = await wellnessApi.getMine(assessmentId)
      if (sequence === assessmentSequence.current) setAssessmentDetail({ loading: false, value })
    } catch (error) {
      if (sequence === assessmentSequence.current) setAssessmentDetail({ loading: false, error: getApiErrorMessage(error, 'Assessment details are unavailable.') })
    }
  }
  const closeAssessment = () => {
    assessmentSequence.current += 1
    setSelectedAssessmentId(null)
    setAssessmentDetail({ loading: false })
  }
  const deleteAssessment = async (assessment: WellnessAssessment) => {
    if (wellnessMutation.current || !window.confirm('Permanently delete this wellness assessment? The backend removes it from your record and this action cannot be undone.')) return
    wellnessMutation.current = true
    wellnessSequence.current += 1
    wellnessRequest.current = null
    setDeletingAssessmentId(assessment.assessment_id)
    setWellnessError('')
    setNotice('')
    try {
      const result = await wellnessApi.removeMine(assessment.assessment_id)
      if (!result.deleted) throw new Error('The backend did not confirm deletion.')
      const remaining = (wellness.value || []).filter(item => item.assessment_id !== assessment.assessment_id)
      setWellness({ loading: false, value: remaining })
      if (selectedAssessmentId === assessment.assessment_id) closeAssessment()
      setNotice('The assessment was deleted by the backend.')
      if (!(await refreshWellness())) setWellnessError('Deletion succeeded, but the assessment list could not refresh. Retry the list refresh to confirm the current records.')
    } catch (error) {
      setWellnessError(getApiErrorMessage(error, 'Assessment deletion failed.'))
    } finally {
      wellnessMutation.current = false
      setDeletingAssessmentId(null)
    }
  }
  const updateConsent = async (type: ConsentType, granted: boolean) => {
    setBusyConsent(type); setNotice('')
    try {
      await consentApi.updateMine({ consent_type: type, granted })
      const updatedConsent = await consentApi.getMine()
      setConsent({ loading: false, value: updatedConsent })
      if (type === 'WELLNESS_DATA_PROCESSING') {
        if (!granted) {
          closeAssessment()
          wellnessSequence.current += 1
          setWellness({ loading: true })
        }
        await refreshWellness()
      }
    }
    catch (error) { setNotice(getApiErrorMessage(error, 'Consent could not be updated.')) }
    finally { setBusyConsent(null) }
  }
  const submitWellness = async (event: FormEvent) => {
    event.preventDefault(); if (submitting || wellnessMutation.current) return
    wellnessMutation.current = true
    wellnessSequence.current += 1
    wellnessRequest.current = null
    setWellness(current => ({ ...current, loading: false, error: undefined }))
    setSubmitting(true); setWellnessError(''); setNotice('')
    try { await wellnessApi.create(payload); setNotice('Your assessment was submitted.'); if (!(await refreshWellness())) setWellnessError('Assessment was submitted, but the assessment list could not refresh.') }
    catch (error) { setWellnessError(errorMessage(error, 'Assessment submission failed.')) }
    finally { wellnessMutation.current = false; setSubmitting(false) }
  }
  const submitSupport = async (event: FormEvent) => {
    event.preventDefault(); if (requestSubmitting) return; setRequestSubmitting(true); setRequestError('')
    try { await supportApi.create({ ...support, message: support.message || undefined, related_alert_id: support.related_alert_id || undefined }); setSupport(v => ({ ...v, message: '', related_alert_id: '' })); setRequests({ loading: false, value: (await supportApi.mine()).requests }) }
    catch (error) { setRequestError(errorMessage(error, 'Support request could not be created.', 'An active support request already exists for this alert.')) }
    finally { setRequestSubmitting(false) }
  }
  const downloadReport = async () => {
    if (!id) return
    setReportBusy(true); setNotice('')
    try { const blob = await reportApi.welfareReport(id); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'welfare-report.pdf'; link.click(); URL.revokeObjectURL(url) }
    catch (error) { setNotice(getApiErrorMessage(error, 'The report is unavailable.')) }
    finally { setReportBusy(false) }
  }

  const contributors = explanation.value?.explanation.top_contributors ?? []
  const wellnessConsent = Boolean(consent.value?.consents.find(item => item.consent_type === 'WELLNESS_DATA_PROCESSING')?.granted)
  if (!id) return <><PageHeader eyebrow="Personnel" title="My welfare workspace" description="Your authenticated account is not linked to a personnel record." /><EmptyState title="Personnel profile link required">Ask an administrator to link this account to your personnel record.</EmptyState></>
  return <>
    <PageHeader eyebrow="Personnel" title="My welfare workspace" description="View your own authorized information, manage consent, and request human support." />
    {notice && <p role="status" className="mb-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">{notice}</p>}
    <div className="mb-5 flex flex-wrap gap-2"><button type="button" disabled={Boolean(deletingAssessmentId) || submitting} onClick={load} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50">Refresh information</button><button type="button" disabled={reportBusy} onClick={downloadReport} className="rounded-lg bg-teal-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{reportBusy ? 'Preparing report...' : 'Download my welfare report'}</button></div>
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Risk prediction" description="Backend generated decision support. It is not a diagnosis or employment decision.">{risk.loading ? <LoadingState /> : risk.error ? <ErrorState message={risk.error} onRetry={load} /> : risk.value ? <><div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-lg bg-teal-50 px-4 py-2 text-lg font-bold">{risk.value.risk_category}</span><span className="text-sm text-slate-500">{risk.value.reference_date} · {risk.value.model_version}</span></div><div className="mt-3 grid grid-cols-3 gap-2">{Object.entries(risk.value.probabilities).map(([key, value]) => <div className="rounded bg-slate-50 p-3 text-sm" key={key}>{key}<strong className="block">{(value * 100).toFixed(1)}%</strong></div>)}</div><p className="mt-2 text-xs text-slate-500">Data mode: {risk.value.data_mode}</p></> : null}</Panel>
      <Panel title="Model explanation" description="Model contribution values describe model behavior; they do not establish causes.">{explanation.loading ? <LoadingState /> : explanation.error ? <ErrorState message={explanation.error} onRetry={load} /> : explanation.value?.explanation.top_contributors.map(item => <div key={item.feature} className="border-b py-2"><div className="flex justify-between gap-3 text-sm"><span>{item.label}</span><strong>{item.shap_value.toFixed(3)}</strong></div><div className="mt-1 h-2 rounded bg-slate-100"><div className={`h-2 rounded ${item.shap_value >= 0 ? 'bg-amber-500' : 'bg-teal-700'}`} style={{ width: `${Math.max(2, Math.abs(item.shap_value) / Math.max(...contributors.map(x => Math.abs(x.shap_value)), 0.00001) * 100)}%` }} /></div></div>)}</Panel>
      <Panel title="Risk history">{history.loading ? <LoadingState /> : history.error ? <ErrorState message={history.error} onRetry={load} /> : history.value?.items.length ? <div className="space-y-2">{history.value.items.map((item, i) => <div key={`${item.reference_date}-${i}`} className="flex justify-between border-b py-2 text-sm"><span>{item.reference_date}</span><strong>{item.risk_category}</strong></div>)}</div> : <EmptyState title="No saved risk history" />}</Panel>
      <Panel title="My consent" description="Consent changes are saved by the backend and default to denied.">{consent.loading ? <LoadingState /> : consent.error ? <ErrorState message={consent.error} onRetry={load} /> : consent.value && <div className="space-y-2">{consentTypes.map(type => { const row = consent.value?.consents.find(item => item.consent_type === type); return <label key={type} className="flex items-center justify-between gap-4 rounded border p-3 text-sm"><span>{type.replace(/_/g, ' ')}</span><input type="checkbox" checked={Boolean(row?.granted)} disabled={busyConsent === type} onChange={event => updateConsent(type, event.target.checked)} aria-label={`Grant ${type.replace(/_/g, ' ')}`} /></label> })}</div>}</Panel>
      <Panel title="Voluntary wellness assessment" description="One assessment per date. Duplicate submissions are rejected by the backend.">
        {!wellnessConsent && <p className="mb-3 text-sm text-slate-600">Grant wellness data processing consent above before submitting an assessment.</p>}
        <form onSubmit={submitWellness} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Assessment date<input required type="date" className={field} value={payload.assessment_date} onChange={e => setPayload(v => ({ ...v, assessment_date: e.target.value }))} /></label>
          {(['sleep_quality', 'fatigue_level', 'perceived_stress', 'mood_wellbeing'] as const).map(key => <label key={key} className="text-sm">{key.replace(/_/g, ' ')} (1-5)<input required min="1" max="5" type="number" className={field} value={payload[key]} onChange={e => setPayload(v => ({ ...v, [key]: Number(e.target.value) }))} /></label>)}
          <button disabled={submitting || Boolean(deletingAssessmentId) || !wellnessConsent} className="rounded-lg bg-teal-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">{submitting ? 'Submitting...' : 'Submit assessment'}</button>
        </form>
        {wellnessError && <p role="alert" className="mt-3 text-sm text-rose-700">{wellnessError}</p>}
        {wellness.loading && !wellness.value ? <LoadingState /> : <div className="mt-3 space-y-2">
          {wellness.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><span>{wellness.error}</span><button type="button" className="underline" onClick={() => void refreshWellness()}>Retry list</button></div>}
          {wellness.value?.length ? wellness.value.map(item => <div key={item.assessment_id} className="flex flex-wrap items-center justify-between gap-3 border-t py-2 text-xs text-slate-600"><span>{item.assessment_date}: sleep {item.sleep_quality}, fatigue {item.fatigue_level}, stress {item.perceived_stress}, mood {item.mood_wellbeing}</span><div className="flex gap-2"><button type="button" disabled={Boolean(deletingAssessmentId)} className="rounded border px-2 py-1 text-teal-900 disabled:opacity-50" onClick={() => void openAssessment(item.assessment_id)}>View</button><button type="button" disabled={Boolean(deletingAssessmentId) || submitting} className="rounded border border-rose-300 px-2 py-1 text-rose-800 disabled:opacity-50" onClick={() => void deleteAssessment(item)}>Delete</button>{deletingAssessmentId === item.assessment_id && <span role="status">Deleting...</span>}</div></div>) : !wellness.loading && !wellness.error ? <EmptyState title="No assessments on file" /> : null}
          {selectedAssessmentId && <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">Assessment details</h3><button type="button" className="text-sm underline" onClick={closeAssessment}>Close</button></div>{assessmentDetail.loading ? <LoadingState label="Loading assessment details" /> : assessmentDetail.error ? <div className="mt-3"><ErrorState message={assessmentDetail.error} onRetry={() => void openAssessment(selectedAssessmentId)} /></div> : assessmentDetail.value && <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Assessment date</dt><dd>{assessmentDetail.value.assessment_date}</dd></div><div><dt className="text-slate-500">Submitted</dt><dd>{assessmentDetail.value.submitted_at || 'Not returned'}</dd></div><div><dt className="text-slate-500">Sleep quality</dt><dd>{assessmentDetail.value.sleep_quality}</dd></div><div><dt className="text-slate-500">Fatigue level</dt><dd>{assessmentDetail.value.fatigue_level}</dd></div><div><dt className="text-slate-500">Perceived stress</dt><dd>{assessmentDetail.value.perceived_stress}</dd></div><div><dt className="text-slate-500">Mood / wellbeing</dt><dd>{assessmentDetail.value.mood_wellbeing}</dd></div></dl>}</div>}
        </div>}
      </Panel>
      <Panel title="Welfare recommendations" description="Backend generated, source-grounded support guidance.">{recommendations.loading ? <LoadingState /> : recommendations.error ? <ErrorState message={recommendations.error} onRetry={load} /> : recommendations.value?.length ? recommendations.value.map((item, i) => <div key={i} className="border-b py-3"><div className="flex justify-between text-sm"><strong>{item.category}</strong><span>{item.priority}</span></div><p className="mt-1 text-sm">{item.action}</p><p className="mt-1 text-xs text-slate-500">{item.rationale}</p><p className="mt-1 text-xs text-slate-500">Sources: {item.sources?.join(', ') || 'Not provided'}</p></div>) : <EmptyState title="No recommendations available" />}</Panel>
      <Panel title="My alerts">{alerts.loading ? <LoadingState /> : alerts.error ? <ErrorState message={alerts.error} onRetry={load} /> : alerts.value?.length ? alerts.value.map(item => <div key={item.alert_id} className="flex justify-between border-b py-2 text-sm"><span>{item.severity} · {item.created_at}</span><strong>{item.status}</strong></div>) : <EmptyState title="No alerts" />}</Panel>
      <Panel title="Request human support" description="This sends a support request to authorized welfare staff."><form onSubmit={submitSupport} className="space-y-3"><label className="block text-sm">Category<select className={field} value={support.category} onChange={e => setSupport(v => ({ ...v, category: e.target.value as SupportCategory }))}>{['GENERAL_WELFARE', 'WORKLOAD_FATIGUE', 'SLEEP_RECOVERY', 'PERSONAL_SUPPORT', 'OTHER'].map(x => <option key={x}>{x}</option>)}</select></label><label className="block text-sm">Urgency<select className={field} value={support.urgency} onChange={e => setSupport(v => ({ ...v, urgency: e.target.value as SupportUrgency }))}><option>NORMAL</option><option>URGENT</option></select></label><label className="block text-sm">Related alert (optional)<select className={field} value={support.related_alert_id} onChange={e => setSupport(v => ({ ...v, related_alert_id: e.target.value }))}><option value="">No related alert</option>{alerts.value?.map(alert => <option key={alert.alert_id} value={alert.alert_id}>{alert.severity} - {alert.status} - {alert.created_at}</option>)}</select></label><label className="block text-sm">Message<textarea maxLength={2000} className={field} rows={3} value={support.message} onChange={e => setSupport(v => ({ ...v, message: e.target.value }))} /></label><button disabled={requestSubmitting} className="rounded-lg bg-teal-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{requestSubmitting ? 'Sending...' : 'Send request'}</button></form>{requestError && <p role="alert" className="mt-3 text-sm text-rose-700">{requestError}</p>}<div className="mt-4">{requests.loading ? <LoadingState /> : requests.error ? <p className="text-sm">{requests.error}</p> : requests.value?.map(item => <div key={item.support_request_id} className="flex justify-between border-t py-2 text-sm"><span>{item.category} · {item.created_at}</span><strong>{item.status}</strong></div>)}</div></Panel>
    </div>
    <p className="mt-5 text-sm text-slate-600"><Link to="/personnel" className="underline">My workspace</Link> · Your information is returned only where the backend authorizes access.</p>
  </>
}

function errorMessage(error: unknown, fallback: string, conflictMessage = 'An assessment already exists for this date. The backend did not replace it.') {
  const base = getApiErrorMessage(error, fallback)
  if (base.includes('conflicts')) return conflictMessage
  return base
}
