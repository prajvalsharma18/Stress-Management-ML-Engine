import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import axios from 'axios'
import { riskApi } from '../../api/risk.api'
import { personnelApi } from '../../api/personnel.api'
import { wellnessApi } from '../../api/wellness.api'
import { welfareApi } from '../../api/welfare.api'
import { reportApi } from '../../api/report.api'
import { PageHeader } from '../../components/common/PageHeader'
import { ForbiddenState } from '../../components/common/States'
import { Alerts, Explanation, OperationalSummary, Panel, PrivacyNotice, Recommendations, RiskHistory, RiskModelMetadata, RiskSummary, SectionState, WellnessSummary } from '../../components/welfare/WelfareParts'
import type { RiskExplanationResponse, RiskHistoryResponse, RiskPredictionResponse } from '../../types/risk'
import type { OperationalRecord, PersonnelDirectoryItem } from '../../types/personnel'
import type { WellnessAssessment } from '../../types/wellness'
import type { WelfareAlert, WelfareRecommendation } from '../../types/welfare'
import { getApiErrorMessage } from '../../utils/apiError'

type Section<T> = { state: 'loading' | 'success' | 'error' | 'forbidden'; data?: T; message?: string }
const initial = <T,>(): Section<T> => ({ state: 'loading' })
const riskErrorMessage = (error: unknown) => {
  if (!axios.isAxiosError(error)) return 'Risk information could not be loaded. Please try again later.'
  switch (error.response?.status) {
    case 403: return 'You are not authorized to view this risk information.'
    case 404: return 'Risk information is not available for this personnel record.'
    case 429: return 'Too many requests. Please wait and try again.'
    default: return 'Risk information could not be loaded. Please try again later.'
  }
}

export function WelfarePersonnelCase() {
  const { personnelId = '' } = useParams()
  const id = decodeURIComponent(personnelId)
  const [risk, setRisk] = useState<Section<RiskPredictionResponse>>(initial())
  const [explanation, setExplanation] = useState<Section<RiskExplanationResponse>>(initial())
  const [history, setHistory] = useState<Section<RiskHistoryResponse>>(initial())
  const [historyPage, setHistoryPage] = useState(1)
  const [personnel, setPersonnel] = useState<Section<PersonnelDirectoryItem>>(initial())
  const personnelRequest = useRef<{ id: string; promise: Promise<void> } | null>(null)
  const [operational, setOperational] = useState<Section<OperationalRecord[]>>(initial())
  const [wellness, setWellness] = useState<Section<WellnessAssessment[]>>(initial())
  const [recommendations, setRecommendations] = useState<Section<WelfareRecommendation[]>>(initial())
  const [alerts, setAlerts] = useState<Section<WelfareAlert[]>>(initial())
  const [reportState, setReportState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [reportMessage, setReportMessage] = useState('')
  const loadRisk = useCallback(() => {
    setRisk(initial())
    riskApi.prediction(id).then(data => setRisk({ state: 'success', data })).catch(error => setRisk({ state: 'error', message: riskErrorMessage(error) }))
  }, [id])
  const loadExplanation = useCallback(() => {
    setExplanation(initial())
    riskApi.explanation(id).then(data => setExplanation({ state: 'success', data })).catch(error => setExplanation({ state: 'error', message: riskErrorMessage(error) }))
  }, [id])
  const loadHistory = useCallback(() => {
    setHistory(initial())
    riskApi.history(id, { page: historyPage, page_size: 10 }).then(data => setHistory({ state: 'success', data })).catch(error => setHistory({ state: 'error', message: riskErrorMessage(error) }))
  }, [historyPage, id])
  const loadPersonnel = useCallback(() => {
    if (personnelRequest.current?.id === id) return personnelRequest.current.promise
    setPersonnel(initial())
    let promise: Promise<void>
    promise = personnelApi.getDirectoryItem(id)
      .then(data => { if (personnelRequest.current?.id === id) setPersonnel({ state: 'success', data }) })
      .catch(error => {
        if (personnelRequest.current?.id === id) {
          if (axios.isAxiosError(error) && error.response?.status === 403) setPersonnel({ state: 'forbidden' })
          else setPersonnel({ state: 'error', message: getApiErrorMessage(error, 'Personnel details are unavailable right now.') })
        }
      }).finally(() => { if (personnelRequest.current?.promise === promise) personnelRequest.current = null })
    personnelRequest.current = { id, promise }
    return promise
  }, [id])
  useEffect(() => {
    const run = <T,>(request: Promise<T>, set: (value: Section<T>) => void) => request.then(data => set({ state: 'success', data })).catch(error => { if (axios.isAxiosError(error) && error.response?.status === 403) set({ state: 'forbidden' }); else set({ state: 'error', message: getApiErrorMessage(error) }) })
    loadRisk()
    loadExplanation()
    loadPersonnel()
    run(personnelApi.getOperational(id, 'duty_records').then(d => d.records), setOperational)
    run(wellnessApi.listForPersonnel(id).then(d => d.assessments), setWellness)
    run(welfareApi.recommendations(id).then(d => d.recommendations || []), setRecommendations)
    run(welfareApi.personnelAlerts(id).then(d => d.alerts), setAlerts)
  }, [id, loadRisk, loadExplanation, loadPersonnel])
  useEffect(() => { loadHistory() }, [loadHistory])
  const downloadReport = async () => {
    setReportState('loading')
    try {
      const blob = await reportApi.welfareReport(id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'surakshai-welfare-report.pdf'
      link.click()
      URL.revokeObjectURL(url)
      setReportState('idle')
    } catch (error) {
      setReportMessage(getApiErrorMessage(error, 'The welfare report is unavailable right now.'))
      setReportState('error')
    }
  }
  const render = <T,>(section: Section<T>, content: (data: T) => ReactNode, empty?: string, retry?: () => void) => section.state === 'forbidden' ? <ForbiddenState /> : section.state === 'success' ? content(section.data as T) : <SectionState state={section.state === 'loading' ? 'loading' : 'error'} message={section.message} empty={empty} retry={retry} />
  return <><div className="mb-5"><Link to="/welfare/personnel" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:underline"><ArrowLeft className="h-4 w-4" />Back to personnel monitoring</Link></div><PageHeader eyebrow="Welfare case view" title={personnel.data?.pseudonymous_reference || personnel.data?.personnel_id || id || 'Personnel case'} description="Backend-supported welfare context for an authorised personnel reference." /><div className="mb-6"><PrivacyNotice /></div><div className="mb-6"><button type="button" onClick={downloadReport} disabled={reportState === 'loading'} className="inline-flex items-center gap-2 rounded-lg border border-teal-800 px-4 py-2.5 text-sm font-semibold text-teal-900 hover:bg-teal-50 disabled:opacity-50"><Download className="h-4 w-4" />{reportState === 'loading' ? 'Preparing report…' : 'Download welfare report'}</button>{reportState === 'error' && <p role="alert" className="mt-2 text-sm text-rose-700">{reportMessage}</p>}</div><div className="grid gap-6">{render(personnel, data => {
    const fields: Array<[string, string | undefined]> = [
      ['Personnel reference', data.pseudonymous_reference || data.personnel_id],
      ['Unit', data.unit_id],
      ['Status', data.status],
      ['Posting type', data.posting_type],
    ]
    const availableFields = fields.filter(([, value]) => Boolean(value))
    return <Panel title="Personnel details" description="Profile fields returned by the authorized personnel directory endpoint.">{availableFields.length ? <dl className="grid gap-3 sm:grid-cols-2">{availableFields.map(([label, value]) => <div key={label}><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-900">{value}</dd></div>)}</dl> : <p className="text-sm text-slate-600">No additional personnel details were returned.</p>}</Panel>
  }, 'Personnel details are unavailable.', loadPersonnel)}{render(operational, data => <OperationalSummary records={data} />, 'Operational information unavailable')}{render(risk, data => <><RiskSummary data={data} /><RiskModelMetadata data={data} /></>, 'Risk information is not available for this personnel record.', loadRisk)}{render(explanation, data => <Explanation data={data} />, 'No risk explanation is currently available.', loadExplanation)}{history.state === 'forbidden' ? <ForbiddenState /> : history.state === 'success' ? <RiskHistory data={history.data as RiskHistoryResponse} onPrevious={() => setHistoryPage(page => Math.max(1, page - 1))} onNext={() => setHistoryPage(page => page + 1)} /> : <SectionState state={history.state === 'loading' ? 'loading' : 'error'} message={history.message} empty="No historical risk predictions are available for this personnel record." retry={loadHistory} />}{render(wellness, data => <WellnessSummary assessments={data} />, 'Voluntary wellness information unavailable')}{render(recommendations, data => <Recommendations items={data} />, 'No welfare recommendations available')}{render(alerts, data => <Alerts alerts={data} />, 'No welfare alerts available')}</div><div className="mt-6"><Panel title="Privacy and interpretation"><p className="text-sm leading-6 text-slate-600">Risk category and workflow alert severity are separate backend concepts. The information shown here supports welfare conversations and should not be interpreted as a medical diagnosis, disciplinary score, or fitness determination.</p></Panel></div></>
}
