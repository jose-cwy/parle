import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Plus, Send, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import HavenModal from './HavenModal'
import { getModeById } from '../../lib/parle/modes'

const IMAGE_CONSENT_KEY = 'parle.image.consent.v1'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_IMAGES = 2
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const TEXTAREA_MAX_HEIGHT = 120

/** Display order and compact labels for the in-chat mode pill selector */
const MODE_PILL_ORDER = ['listen', 'vent', 'comfort', 'honest', 'understand', 'dont_text']

const MODE_PILL_LABELS = {
  listen: 'Just listen',
  vent: 'Need to vent',
  comfort: 'Comfort me first',
  honest: 'Be honest',
  understand: 'Help me understand',
  dont_text: 'Stop reaching out',
}

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function ModePillSelector({ activeModeId, onSelect, onClose, anchorRef }) {
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (
        menuRef.current?.contains(e.target) ||
        anchorRef.current?.contains(e.target)
      ) {
        return
      }
      onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose, anchorRef])

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full right-0 mb-2 max-w-[min(100vw-2rem,28rem)] rounded-[20px] border border-border bg-[var(--cream)] px-2.5 py-2 z-30 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
      role="listbox"
      aria-label="Conversation mode"
    >
      <div className="flex flex-wrap gap-1.5">
        {MODE_PILL_ORDER.map((id) => {
          const mode = getModeById(id)
          const active = id === activeModeId
          return (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onSelect(mode)}
              className={cn(
                'text-[12px] leading-none py-[5px] px-3 rounded-[20px] border transition-colors whitespace-nowrap',
                active
                  ? 'bg-primary/15 border-primary text-primary'
                  : 'bg-transparent border-border text-muted-foreground hover:bg-primary/[0.08]',
              )}
            >
              {MODE_PILL_LABELS[id] || mode.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ChatInputBar({
  text,
  onTextChange,
  onSend,
  disabled,
  activeModeId,
  chatStarted,
  onModeChange,
  isAuthed,
  imageConsentFromServer,
  showDisclaimer = false,
}) {
  const [modeOpen, setModeOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [micDenied, setMicDenied] = useState(false)
  const [imageError, setImageError] = useState('')
  const [attachments, setAttachments] = useState([])
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [imageConsent, setImageConsent] = useState(false)

  const modeButtonRef = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const recognitionRef = useRef(null)
  const recordingRef = useRef(false)
  const preRecordingTextRef = useRef('')

  const SpeechRecognition = getSpeechRecognition()
  const showMic = Boolean(SpeechRecognition)

  useEffect(() => {
    if (isAuthed) {
      setImageConsent(Boolean(imageConsentFromServer))
      return
    }
    try {
      setImageConsent(localStorage.getItem(IMAGE_CONSENT_KEY) === '1')
    } catch {
      setImageConsent(false)
    }
  }, [isAuthed, imageConsentFromServer])

  useEffect(() => {
    if (!micDenied) return undefined
    const t = setTimeout(() => setMicDenied(false), 3000)
    return () => clearTimeout(t)
  }, [micDenied])

  useEffect(() => {
    if (!imageError) return undefined
    const t = setTimeout(() => setImageError(''), 3000)
    return () => clearTimeout(t)
  }, [imageError])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.()
    }
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`
  }, [text])

  const persistImageConsent = useCallback(async () => {
    setImageConsent(true)
    if (isAuthed) {
      await fetch('/api/chat/context', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_attach_consent: true }),
      }).catch(() => null)
      return
    }
    try {
      localStorage.setItem(IMAGE_CONSENT_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [isAuthed])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleAttachClick = useCallback(() => {
    if (imageConsent) {
      openFilePicker()
      return
    }
    setShowConsentModal(true)
  }, [imageConsent, openFilePicker])

  const handleConsentContinue = useCallback(async () => {
    setShowConsentModal(false)
    await persistImageConsent()
    openFilePicker()
  }, [persistImageConsent, openFilePicker])

  const handleFiles = useCallback(
    (fileList) => {
      const files = Array.from(fileList || [])
      if (!files.length) return

      const remaining = MAX_IMAGES - attachments.length
      if (remaining <= 0) return

      files.slice(0, remaining).forEach((file) => {
        if (!ACCEPTED_TYPES.includes(file.type)) return
        if (file.size > MAX_IMAGE_BYTES) {
          setImageError('Image too large. Max 5MB.')
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = String(reader.result || '')
          if (!dataUrl) return
          setAttachments((prev) => {
            if (prev.length >= MAX_IMAGES) return prev
            return [
              ...prev,
              { id: `${Date.now()}-${Math.random()}`, preview: dataUrl, dataUrl },
            ]
          })
        }
        reader.readAsDataURL(file)
      })
    },
    [attachments.length],
  )

  const removeAttachment = useCallback((id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const stopRecording = useCallback(() => {
    recordingRef.current = false
    recognitionRef.current?.stop?.()
    recognitionRef.current = null
    setRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    if (!SpeechRecognition) return

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setMicDenied(true)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = true

    preRecordingTextRef.current = text

    recognition.onresult = (event) => {
      let interim = ''
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0]?.transcript || ''
        if (event.results[i].isFinal) finalText += chunk
        else interim += chunk
      }
      const base = preRecordingTextRef.current
      const combined = `${base}${base && (finalText || interim) ? ' ' : ''}${finalText}${interim}`.trim()
      onTextChange(combined)
      if (finalText) {
        preRecordingTextRef.current = `${base}${base ? ' ' : ''}${finalText}`.trim()
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicDenied(true)
      }
      stopRecording()
    }

    recognition.onend = () => {
      if (recordingRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start()
        } catch {
          stopRecording()
        }
      }
    }

    recognitionRef.current = recognition
    recordingRef.current = true
    setRecording(true)
    try {
      recognition.start()
    } catch {
      stopRecording()
      setMicDenied(true)
    }
  }, [SpeechRecognition, text, onTextChange, stopRecording])

  const toggleMic = useCallback(() => {
    if (recording) stopRecording()
    else startRecording()
  }, [recording, startRecording, stopRecording])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (disabled) return
    const trimmed = String(text || '').trim()
    if (!trimmed && !attachments.length) return
    onSend({
      text: trimmed,
      images: attachments.map((a) => a.dataUrl),
    })
    setAttachments([])
    if (recording) stopRecording()
  }

  const canSend = (String(text || '').trim().length > 0 || attachments.length > 0) && !disabled
  const modeId = activeModeId || 'listen'

  return (
    <div className="parle-chat__input-wrap">
      {attachments.length > 0 && (
        <div className="mb-2 flex gap-2 justify-center">
          {attachments.map((item) => (
            <div key={item.id} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.preview}
                alt=""
                className="h-20 w-20 rounded-lg object-cover border border-border"
              />
              <button
                type="button"
                onClick={() => removeAttachment(item.id)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-card border border-border grid place-items-center text-muted-foreground hover:text-foreground"
                aria-label="Remove image"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {micDenied && (
        <p className="mb-2 text-[12px] text-muted-foreground">
          Microphone access needed. Check your browser settings.
        </p>
      )}

      {imageError && (
        <p className="mb-2 text-[12px] text-muted-foreground">{imageError}</p>
      )}

      <form onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />

        <div
          className={cn(
            'flex items-end gap-1.5 min-h-[52px] px-4 py-2.5 rounded-full',
            'bg-white border border-border/80',
            'shadow-[0_1px_6px_rgba(0,0,0,0.06)]',
            'focus-within:border-border transition',
          )}
        >
          <button
            type="button"
            onClick={handleAttachClick}
            disabled={disabled || attachments.length >= MAX_IMAGES}
            className="h-8 w-8 shrink-0 self-center text-muted-foreground hover:text-foreground grid place-items-center transition disabled:opacity-40 -ml-1"
            aria-label="Attach image"
          >
            <Plus size={20} strokeWidth={1.75} />
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            rows={1}
            placeholder="say what's on your mind..."
            style={{ maxHeight: TEXTAREA_MAX_HEIGHT }}
            className="flex-1 resize-none bg-transparent border-0 outline-none text-[15px] leading-relaxed placeholder:text-muted-foreground/50 min-w-0 self-center py-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            disabled={disabled}
          />

          {chatStarted && (
            <div className="relative shrink-0 self-center">
              <button
                ref={modeButtonRef}
                type="button"
                onClick={() => setModeOpen((o) => !o)}
                disabled={disabled}
                className="h-8 w-8 grid place-items-center text-muted-foreground hover:text-foreground transition rounded-full hover:bg-secondary/60"
                aria-expanded={modeOpen}
                aria-haspopup="listbox"
                aria-label="Change conversation mode"
              >
                <SlidersHorizontal size={18} strokeWidth={1.75} />
              </button>
              {modeOpen && (
                <ModePillSelector
                  activeModeId={modeId}
                  anchorRef={modeButtonRef}
                  onClose={() => setModeOpen(false)}
                  onSelect={(mode) => {
                    setModeOpen(false)
                    onModeChange(mode)
                  }}
                />
              )}
            </div>
          )}

          {showMic && (
            <button
              type="button"
              onClick={toggleMic}
              disabled={disabled}
              className={cn(
                'relative h-8 w-8 shrink-0 self-center grid place-items-center transition rounded-full',
                recording
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
              )}
              aria-label={recording ? 'Stop recording' : 'Start voice input'}
            >
              {recording && (
                <span
                  className="absolute inset-0 rounded-full bg-primary/15 animate-pulse"
                  aria-hidden
                />
              )}
              <Mic size={18} strokeWidth={1.75} className="relative z-[1]" />
            </button>
          )}

          <button
            type="submit"
            className={cn(
              'h-9 w-9 shrink-0 self-center rounded-full grid place-items-center transition active:scale-95 -mr-0.5',
              canSend
                ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm'
                : 'bg-secondary/70 text-muted-foreground',
            )}
            disabled={!canSend}
            aria-label="Send"
          >
            <Send size={15} strokeWidth={2.25} className={canSend ? 'text-primary-foreground' : ''} />
          </button>
        </div>
      </form>

      {showDisclaimer && (
        <p className="mt-2 text-center text-[11px] italic text-muted-foreground opacity-[0.35] leading-relaxed px-2">
          parlé can make mistakes. This is not a substitute for professional help.
        </p>
      )}

      {showConsentModal && (
        <HavenModal onClose={() => setShowConsentModal(false)} small>
          <h2 className="font-serif text-xl text-foreground">Before you attach an image</h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Screenshots may contain private conversations belonging to other people. By attaching,
            you confirm the content is yours to share and you understand parlé&apos;s AI will read
            it to help support you.
          </p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            This is not stored beyond your current session.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleConsentContinue}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] hover:opacity-90 transition"
            >
              I understand, continue
            </button>
            <button
              type="button"
              onClick={() => setShowConsentModal(false)}
              className="h-10 px-4 rounded-xl border border-border text-[13px] text-muted-foreground hover:text-foreground transition"
            >
              Cancel
            </button>
          </div>
        </HavenModal>
      )}
    </div>
  )
}
