import { useEffect, useState } from 'react'
import RequireAuth from '../components/RequireAuth'
import DeskScene from '../components/DeskScene'
import LetterEditor from '../components/LetterEditor'
import Notification from '../components/Notification'
import ConfirmationModal from '../components/ConfirmationModal'
import { SkeletonLetterRoom } from '../components/Skeleton'

export default function LetterToYourselfPage(){
  const [letter, setLetter] = useState(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isSealing, setIsSealing] = useState(false)
  const [showSavedToast, setShowSavedToast] = useState(false)
  const [pendingCompletedLetter, setPendingCompletedLetter] = useState(null)
  const [modalState, setModalState] = useState({ open: false, mode: 'status', title: '', description: '' })

  useEffect(() => {
    fetchLetter()
  }, [])

  useEffect(() => {
    if(!showSavedToast) return

    const timeout = window.setTimeout(() => setShowSavedToast(false), 1800)
    return () => window.clearTimeout(timeout)
  }, [showSavedToast])

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
    setShowSavedToast(true)
  }

  function handleRequestComplete(){
    if(!letter?.id && !draft.trim()){
      alert('Save your draft before marking it complete.')
      return
    }

    setModalState({
      open: true,
      mode: 'confirm-complete',
      title: 'Complete this letter?',
      description: 'Your letter will fold away and stay locked until your journey is complete.'
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

    // Keep the old paper visible until the fly-away animation finishes.
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
      title: 'Your letter is now locked',
      description: 'It will stay sealed until your journey is complete.'
    })
  }

  return (
    <RequireAuth>
      {loading ? (
        <SkeletonLetterRoom />
      ) : (
        <>
          <DeskScene
            isSealing={isSealing}
            onSealAnimationComplete={handleSealAnimationComplete}
          >
            <LetterEditor
              value={draft}
              onChange={setDraft}
              onSave={handleSaveDraft}
              onComplete={handleRequestComplete}
              loading={saving}
              isCompleted={Boolean(letter?.is_completed)}
              isSealing={isSealing}
              updatedAt={letter?.updated_at}
            />
          </DeskScene>

          <Notification open={showSavedToast} message="Saved!" />
        </>
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
