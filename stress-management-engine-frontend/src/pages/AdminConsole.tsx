import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { adminApi } from '../api/admin.api'
import { modelTrainingApi } from '../api/modelTraining.api'
import { welfareApi } from '../api/welfare.api'
import { PageHeader } from '../components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { Panel } from '../components/welfare/WelfareParts'
import type { AdminUser, CreateAdminUserRequest, UserStatus } from '../types/admin'
import type { ModelRegistry, TrainingJob, TrainingPlan } from '../types/modelTraining'
import type { Role } from '../types/auth'
import type { WelfareDashboardSummary } from '../types/operational'
import { getApiErrorMessage } from '../utils/apiError'

const input = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
const roles: Role[] = ['PERSONNEL', 'WELFARE_OFFICER', 'COMMANDER', 'ADMIN']

export function AdminConsole() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [jobs, setJobs] = useState<TrainingJob[]>([])
  const [registry, setRegistry] = useState<ModelRegistry | null>(null)
  const [summary, setSummary] = useState<WelfareDashboardSummary | null>(null)
  const [jobDetail, setJobDetail] = useState<TrainingJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [request, setRequest] = useState('train a new candidate risk model using the latest approved dataset.')
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [newUser, setNewUser] = useState<CreateAdminUserRequest>({ username: '', password: '', role: 'PERSONNEL', personnel_id: '', status: 'ACTIVE' })

  const load = useCallback(() => {
    setLoading(true); setError('')
    Promise.all([adminApi.listUsers(), modelTrainingApi.jobs(), modelTrainingApi.models(), welfareApi.dashboardSummary()])
      .then(([userData, jobData, modelData, dashboardData]) => { setUsers(userData.users); setJobs(jobData.jobs); setRegistry(modelData); setSummary(dashboardData) })
      .catch(e => setError(getApiErrorMessage(e, 'Administrator data could not be loaded.')))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const createUser = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await adminApi.createUser({ ...newUser, personnel_id: newUser.personnel_id || undefined }); setNewUser({ username: '', password: '', role: 'PERSONNEL', personnel_id: '', status: 'ACTIVE' }); setNotice('User account created.'); await load() }
    catch (e) { setError(getApiErrorMessage(e, 'User account could not be created.')) }
    finally { setBusy(false) }
  }
  const changeStatus = async (user: AdminUser, status: UserStatus) => {
    setBusy(true); setError('')
    try { await adminApi.updateUser(user.user_id, { status }); setNotice(`Account ${user.username} updated.`); await load() }
    catch (e) { setError(getApiErrorMessage(e, 'User account could not be updated.')) }
    finally { setBusy(false) }
  }
  const createPlan = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setPlan(null)
    try { setPlan(await modelTrainingApi.plan(request)) }
    catch (e) { setError(getApiErrorMessage(e, 'Training plan was rejected.')) }
    finally { setBusy(false) }
  }
  const confirmPlan = async () => {
    if (!plan || !window.confirm('Confirm and enqueue this candidate model training job?')) return
    setBusy(true); setError('')
    try { const result = await modelTrainingApi.confirm(plan.plan_id); setPlan(null); setNotice(`Training job queued: ${result.job_id}`); await load() }
    catch (e) { setError(getApiErrorMessage(e, 'Training plan could not be confirmed.')) }
    finally { setBusy(false) }
  }
  const promote = async (modelVersion: string) => {
    if (!window.confirm(`Promote ${modelVersion} to the active model? This changes the model used for new predictions.`)) return
    setBusy(true); setError('')
    try { const result = await modelTrainingApi.promote(modelVersion); setNotice(`Active model is now ${result.model_version}. Rollback reference: ${result.rollback_model_id}`); await load() }
    catch (e) { setError(getApiErrorMessage(e, 'Model promotion failed.')) }
    finally { setBusy(false) }
  }
  const loadJobDetail = async (jobId: string) => {
    setBusy(true); setError('')
    try { setJobDetail(await modelTrainingApi.job(jobId)) }
    catch (e) { setError(getApiErrorMessage(e, 'Training job details are unavailable.')) }
    finally { setBusy(false) }
  }

  return <><PageHeader eyebrow="Administrator" title="Administration and model lifecycle" description="Manage user accounts and backend-controlled candidate training. Training and promotion require explicit confirmation." /><div className="mb-4 flex flex-wrap gap-2"><button className={input} onClick={load}>Refresh</button>{notice && <p role="status" className="self-center text-sm text-teal-800">{notice}</p>}</div>{error && <div className="mb-4"><ErrorState message={error} onRetry={load} /></div>}{loading ? <LoadingState /> : <div className="space-y-6">
    <Panel title="User management" description="Only backend-authorized account fields are displayed."><form onSubmit={createUser} className="mb-5 grid gap-3 md:grid-cols-5"><label className="text-sm">Username<input required className={`${input} mt-1 w-full`} value={newUser.username} onChange={e => setNewUser(v => ({ ...v, username: e.target.value }))} /></label><label className="text-sm">Temporary password<input required minLength={12} type="password" className={`${input} mt-1 w-full`} value={newUser.password} onChange={e => setNewUser(v => ({ ...v, password: e.target.value }))} /></label><label className="text-sm">Role<select className={`${input} mt-1 w-full`} value={newUser.role} onChange={e => setNewUser(v => ({ ...v, role: e.target.value as Role }))}>{roles.map(role => <option key={role}>{role}</option>)}</select></label><label className="text-sm">Personnel ID (optional)<input className={`${input} mt-1 w-full`} value={newUser.personnel_id} onChange={e => setNewUser(v => ({ ...v, personnel_id: e.target.value }))} /></label><button disabled={busy} className="self-end rounded-lg bg-teal-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Create account</button></form>{users.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-2">Username</th><th className="p-2">Role</th><th className="p-2">Personnel link</th><th className="p-2">Status</th><th className="p-2">Account action</th></tr></thead><tbody>{users.map(user => <tr key={user.user_id} className="border-b"><td className="p-2">{user.username}</td><td className="p-2">{user.role}</td><td className="p-2">{user.personnel_id || '—'}</td><td className="p-2">{user.status}</td><td className="p-2"><button disabled={busy} className={input} onClick={() => changeStatus(user, user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')}>{user.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button></td></tr>)}</tbody></table></div> : <EmptyState title="No user accounts returned" />}</Panel>
    <Panel title="Plan candidate training" description="The backend accepts only approved training instructions/configuration. This form does not execute model code in the browser."><form onSubmit={createPlan} className="space-y-3"><label className="block text-sm">Training request<textarea rows={2} maxLength={300} required className={`${input} mt-1 w-full`} value={request} onChange={e => setRequest(e.target.value)} /><span className="mt-1 block text-xs text-slate-500">The backend only accepts its allow-listed request wording or a valid constrained configuration.</span></label><button disabled={busy} className="rounded-lg bg-teal-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Create training plan</button></form>{plan && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold">Plan requires separate confirmation</h3><dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Plan ID</dt><dd>{plan.plan_id}</dd></div><div><dt className="text-slate-500">Candidate version</dt><dd>{plan.candidate_model_version}</dd></div><div><dt className="text-slate-500">Dataset</dt><dd>{plan.dataset_id}</dd></div><div><dt className="text-slate-500">Feature contract</dt><dd>{plan.feature_version}</dd></div></dl><button disabled={busy} onClick={confirmPlan} className="mt-3 rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white">Confirm and enqueue</button></div>}</Panel>
    <Panel title="Training jobs" description="Job state and metrics are read from the backend; worker execution is asynchronous.">{jobs.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-2">Status</th><th className="p-2">Model version</th><th className="p-2">Created</th><th className="p-2">Metrics / result</th><th className="p-2">Details</th></tr></thead><tbody>{jobs.map(job => <tr key={job.job_id} className="border-b align-top"><td className="p-2">{job.status}</td><td className="p-2">{job.model_version}</td><td className="p-2">{job.created_at}</td><td className="p-2">{job.metrics ? <pre className="max-w-md overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(job.metrics, null, 2)}</pre> : job.error_summary || 'No result yet'}</td><td className="p-2"><button disabled={busy} className={input} onClick={() => loadJobDetail(job.job_id)}>View job</button></td></tr>)}</tbody></table></div> : <EmptyState title="No training jobs have been returned" />}{jobDetail && <div className="mt-4 rounded-lg border bg-slate-50 p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Training job details</h3><button className={input} onClick={() => setJobDetail(null)}>Close</button></div><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Job ID</dt><dd>{jobDetail.job_id}</dd></div><div><dt className="text-slate-500">Status</dt><dd>{jobDetail.status}</dd></div><div><dt className="text-slate-500">Feature version</dt><dd>{jobDetail.feature_version || 'Not returned'}</dd></div><div><dt className="text-slate-500">Started</dt><dd>{jobDetail.started_at || 'Not started'}</dd></div><div><dt className="text-slate-500">Completed</dt><dd>{jobDetail.completed_at || 'Not completed'}</dd></div></dl><Metrics metrics={jobDetail.metrics} />{jobDetail.error_summary && <p className="mt-2 text-sm text-rose-700">{jobDetail.error_summary}</p>}</div>}</Panel>
    <Panel title="Model versions" description="Candidate promotion is available only when backend metadata permits it.">{registry?.active_model ? <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 p-4"><p className="text-xs uppercase text-teal-800">Active model</p><p className="mt-1 font-semibold">{registry.active_model.model_version}</p><p className="text-sm">Feature contract: {registry.active_model.feature_version || 'Not returned'}</p><Metrics metrics={registry.active_model.metrics} /></div> : <EmptyState title="No active model metadata returned" />}{registry?.candidate_models.map(model => <div key={model.model_version} className="mb-3 rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{model.model_version}</p><p className="text-sm text-slate-500">{model.status} · {model.dataset_id || 'Dataset not returned'} · {model.trained_at || 'Training time not returned'}</p></div><button disabled={busy || !model.promotion_allowed} onClick={() => model.model_version && promote(model.model_version)} className="rounded-lg border border-teal-800 px-3 py-2 text-sm font-semibold text-teal-900 disabled:opacity-40">Promote candidate</button></div><p className="mt-2 text-xs text-slate-500">Feature contract: {model.feature_version || 'Not returned'}</p><Metrics metrics={model.metrics} /></div>)}</Panel>
    <Panel title="Welfare overview" description="Privacy-minimized aggregate metrics returned by the backend.">{summary ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Authorized personnel', summary.personnel.total_authorized], ['Low risk', summary.risk.LOW], ['Elevated risk', summary.risk.ELEVATED], ['High risk', summary.risk.HIGH], ['Open alerts', summary.alerts.open], ['Priority alerts', summary.alerts.priority], ['Active interventions', summary.interventions.active], ['Follow-up interventions', summary.interventions.follow_up]].map(([label, value]) => <div key={String(label)} className="rounded-lg border p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div> : <EmptyState title="Aggregate summary unavailable" />}<p className="mt-3 text-xs text-slate-500">Generated {summary?.generated_at || 'time not returned'}</p></Panel>
  </div>}</>
}

function Metrics({ metrics }: { metrics?: Record<string, unknown> }) { return metrics ? <dl className="mt-3 flex flex-wrap gap-3 text-xs">{Object.entries(metrics).map(([key, value]) => <div key={key} className="rounded bg-white/70 px-2 py-1"><dt className="text-slate-500">{key}</dt><dd className="font-semibold">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl> : <p className="mt-2 text-xs text-slate-500">No evaluation metrics returned.</p> }
