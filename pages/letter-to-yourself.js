import { useEffect, useState } from 'react'
import RequireAuth from '../components/RequireAuth'
import LetterEditor from '../components/LetterEditor'
import ConfirmationModal from '../components/ConfirmationModal'

export default function LetterToYourselfPage(){
  const [letter, setLetter] = useState(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isSealing, setIsSealing] = useState(false)
  const [pendingCompletedLetter, setPendingCompletedLetter] = useState(null)
  const [modalState, setModalState] = useState({ open: false, mode: 'status', title: '', description: '' })

  useEffect(() => {
    fetchLetter()
  }, [])

  async function fetchLetter(){
    setLoading(true)
    const res = await fetch('/api/letters/self')
    const data = await res.json().catch(() => ({ letter: null }))

    if(res.ok){
      setLetter(data.letter)
      setDraft(data.letter?.content || '')
    }

    setLoading(false)
  }

  async function handleSaveDraft(){
    if(!draft.trim()) return alert('Write a little before saving your draft.')
    setSaving(true)

    const method = letter ? 'PUT' : 'POST'
    const res = await fetch('/api/letters/self', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: draft })
    })

    const data = await res.json().catch(() => null)
    setSaving(false)

    if(!res.ok) return alert(data?.error || 'Unable to save your draft right now.')

    setLetter(data.letter)
    setDraft(data.letter?.content || '')
    setModalState({
      open: true,
      mode: 'status',
      title: 'Draft saved',
      description: 'Your letter is resting on the table and saved privately to your account.'
    })
  }

  function handleRequestComplete(){
    if(!letter?.id && !draft.trim()){
      alert('Save your draft before marking it complete.')
      return
    }

    setModalState({
      open: true,
      mode: 'confirm-complete',
      title: 'Finish and lock this letter?',
      description: 'Once you finish it, the page will fold the letter away and the content will stop being readable in V1.'
    })
  }

  async function handleCompleteLetter(){
    setSaving(true)

    if(!letter?.id){
      const createRes = await fetch('/api/letters/self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft })
      })

      const createData = await createRes.json().catch(() => null)
      if(!createRes.ok){
        setSaving(false)
        return alert(createData?.error || 'Unable to save the draft before completion.')
      }

      setLetter(createData.letter)
    }

    const res = await fetch('/api/letters/self', { method: 'PATCH' })
    const data = await res.json().catch(() => null)
    setSaving(false)

    if(!res.ok) return alert(data?.error || 'Unable to complete this letter right now.')

    // Delay the state swap until the fold-and-flight animation finishes.
    setPendingCompletedLetter(data.letter)
    setModalState({ open: false, mode: 'status', title: '', description: '' })
    setIsSealing(true)
  }

  function handleSealAnimationComplete(){
    setIsSealing(false)
    setLetter(prev => ({ ...(prev || {}), ...(pendingCompletedLetter || {}), content: null }))
    setDraft('')
    setPendingCompletedLetter(null)
    setModalState({
      open: true,
      mode: 'status',
      title: 'Letter locked',
      description: 'The letter folded away and is now sealed. You can keep the memory, but not reopen the text yet.'
    })
  }

  return (
    <RequireAuth>
      {loading ? (
        <div className="card p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border border-[rgba(140,97,71,0.2)] border-t-[#b88957] spinner-ring" />
          <p className="text-lg font-semibold text-[#241e1a]">Loading your room...</p>
        </div>
      ) : (
        <LetterEditor
          value={draft}
          onChange={setDraft}
          onSave={handleSaveDraft}
          onComplete={handleRequestComplete}
          loading={saving}
          isCompleted={Boolean(letter?.is_completed)}
          isSealing={isSealing}
          updatedAt={letter?.updated_at}
          onSealAnimationComplete={handleSealAnimationComplete}
        />
      )}

      <ConfirmationModal
        open={modalState.open}
        title={modalState.title}
        description={modalState.description}
        confirmLabel={modalState.mode === 'confirm-complete' ? 'Lock letter' : 'Close'}
        cancelLabel={modalState.mode === 'confirm-complete' ? 'Keep writing' : undefined}
        confirmVariant={modalState.mode === 'confirm-complete' ? 'danger' : 'primary'}
        busy={saving}
        onCancel={() => setModalState({ open: false, mode: 'status', title: '', description: '' })}
        onConfirm={() => {
          if(modalState.mode === 'confirm-complete'){
            handleCompleteLetter()
            return
          }

          setModalState({ open: false, mode: 'status', title: '', description: '' })
        }}
      />
    </RequireAuth>
  )
}
