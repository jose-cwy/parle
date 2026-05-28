import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import RequireAuth from '../components/RequireAuth'
import AppShell from '../components/AppShell'
import DeskScene from '../components/DeskScene'
import LetterEditor from '../components/LetterEditor'
import Notification from '../components/Notification'
import ConfirmationModal from '../components/ConfirmationModal'
import { LetterSkeleton } from '../components/loading'
import { pulseWarmth } from '../lib/warmthPulse'

const EXPO = [0.16, 1, 0.3, 1]

export default function LetterToYourselfPage(){
  const router = useRouter()
  const [letter, setLetter] = useState(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isSealing, setIsSealing] = useState(false)
  const [showSavedToast, setShowSavedToast] = useState(false)
  const [pendingCompletedLetter, setPendingCompletedLetter] = useState(null)
  const [modalState, setModalState] = useState({ open: false, mode: 'status', title: '', description: '' })

  /* Welcome banner — shown when arriving from first-time login */
  const [showWelcome, setShowWelcome] = useState(false)
  useEffect(() => {
    if (router.query.welcome === '1') {
      setShowWelcome(true)
      /* Auto-dismiss after 7s */
      const t = setTimeout(() => setShowWelcome(false), 7000)
      return () => clearTimeout(t)
    }
  }, [router.query.welcome])

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
    pulseWarmth(0.9, 1800)
  }

  function handleRequestComplete(){
    if(!letter?.id && !draft.trim()){
      alert('Save your draft before marking it complete.')
      return
    }

    setModalState({
      open: true,
      mode: 'confirm-complete',
      title: 'Seal this letter?',
      description: 'It will fold away and stay private. You can stop carrying these words tonight.'
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
    pulseWarmth(1, 2200)
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
      description: 'It is sealed and kept private. You can come back when you are ready.'
    })
  }

  return (
    <RequireAuth>
      <AppShell>
      <div className="app-page-intro" style={{ marginBottom: '1.25rem' }}>
        <div>
          <p className="eyebrow">Closure letter</p>
          <h2 className="mt-2 section-title">Write what you never got to say.</h2>
        </div>
        <p className="subtle text-base leading-7 md:text-right">
          This stays private. When you are ready, you can seal it away and stop carrying it in your head.
        </p>
      </div>
      {/* First-time welcome banner */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            key="welcome-banner"
            className="app-welcome-banner"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.55, ease: EXPO }}
            style={{
              position: 'fixed',
              top: '4.5rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 50,
              maxWidth: 560,
              width: 'calc(100% - 2rem)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.85rem',
            }}
          >
            <span style={{ fontSize: '1.2rem', flexShrink: 0, marginTop: '0.1rem' }} aria-hidden="true">♡</span>
            <div style={{ flex: 1 }}>
              <p>
                This is your first letter. Write to the future you — seal it, and open it when you are ready.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWelcome(false)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <LetterSkeleton />
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
      </AppShell>
    </RequireAuth>
  )
}
