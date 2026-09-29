import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { personnelApi } from '../../api/personnel.api'
import { PageHeader } from '../../components/common/PageHeader'
import { ErrorState, LoadingState } from '../../components/common/States'
import { Panel, PersonnelLinks } from '../../components/welfare/WelfareParts'
import type { PersonnelDirectoryItem, PersonnelStatus } from '../../types/personnel'
import { getApiErrorMessage } from '../../utils/apiError'

const pageSize = 25
export function WelfarePersonnel() {
  const [items, setItems] = useState<PersonnelDirectoryItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PersonnelStatus | ''>('')
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const load = useCallback(() => {
    setState('loading')
    personnelApi.directory({ page, page_size: pageSize, ...(search ? { search } : {}), ...(status ? { status } : {}) })
      .then(data => { setItems(data.items); setTotal(data.total); setState('success') })
      .catch(error => { setMessage(getApiErrorMessage(error, 'Personnel directory is unavailable right now.')); setState('error') })
  }, [page, search, status])
  useEffect(() => { load() }, [load])
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()) }
  const changeStatus = (value: PersonnelStatus | '') => { setPage(1); setStatus(value) }
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return <>
    <PageHeader eyebrow="Welfare officer" title="Personnel monitoring" description="Search personnel records returned by the authorized welfare directory." />
    {state === 'loading' && <LoadingState label="Loading personnel directory" />}
    {state === 'error' && <ErrorState message={message} onRetry={load} />}
    {state === 'success' && <Panel title="Personnel directory" description={`${total} authorized record${total === 1 ? '' : 's'} in the directory`}>
      <form onSubmit={submitSearch} className="mb-5 grid gap-3 sm:grid-cols-[1fr_200px_auto]">
        <label className="text-sm font-medium text-slate-700">Search reference<input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search personnel reference" className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100" /></label>
        <label className="text-sm font-medium text-slate-700">Personnel status<select value={status} onChange={event => changeStatus(event.target.value as PersonnelStatus | '')} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ON_LEAVE">On leave</option><option value="TEMPORARILY_INACTIVE">Temporarily inactive</option></select></label>
        <button className="self-end rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900">Search</button>
      </form>
      <PersonnelLinks personnel={items} />
      <div className="mt-4 flex items-center justify-between text-sm text-slate-600"><span>Page {page} of {pageCount}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50">Previous</button><button type="button" disabled={page >= pageCount} onClick={() => setPage(value => value + 1)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50">Next</button></div></div>
    </Panel>}
  </>
}
