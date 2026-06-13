import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, ChevronDown, Loader2, Mic, Plus, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import HavenModal from './HavenModal'
import {
  getModeById,
  getModeLabel,
  getModePillClasses,
  getModeShortLabel,
  MODE_PILL_ORDER,
} from '../../lib/parle/modes'

const IMAGE_CONSENT_KEY = 'parle.image.consent.v1'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_IMAGES = 2
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const TEXTAREA_MAX_HEIGHT = 120

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function useIsMobileSheet() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isMobile
}

function ModePillSelector({ activeModeId, onSelect, onClose, anchorRef, sheet = false }) {
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

  const menu = (
    <div
      ref={menuRef}
      className={cn('parle-mode-selector__menu', sheet && 'parle-mode-selector__menu--sheet')}
      role="listbox"
      aria-label="Conversation mode"
    >
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
            className={getModePillClasses(id, { selected: active, compact: true, filled: true })}
          >
            {getModeLabel(id)}
          </button>
        )
      })}
    </div>
  )

  if (!sheet) return menu

  return (
    <>
      <button
        type="button"
        className="parle-mode-selector__backdrop"
        aria-label="Close mode selector"
        onClick={onClose}
      />
      {menu}
    </>
  )
}

export default function ChatInputBar({
  text,
  onTextChange,
  onSend,
  disabled,
  loading = false,
  activeModeId,
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

  const isMobileSheet = useIsMobileSheet()
  const modeButtonRef = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const recognitionRef = useRef(null)
  const recordingRef = useRef(false)
  const preRecordingTextRef = useRef('')

  const [micAvailable, setMicAvailable] = useState(false)

  useEffect(() => {
    setMicAvailable(Boolean(getSpeechRecognition()))
  }, [])

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
    const SpeechRecognitionCtor = getSpeechRecognition()
    if (!SpeechRecognitionCtor) return

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setMicDenied(true)
      return
    }

    const recognition = new SpeechRecognitionCtor()
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
  }, [text, onTextChange, stopRecording])

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
  const modeId = activeModeId || 'cross'

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
        <p className="mb-2 text-[10px] text-muted-foreground">
          Microphone access needed. Check your browser settings.
        </p>
      )}

      {imageError && (
        <p className="mb-2 text-[10px] text-muted-foreground">{imageError}</p>
      )}

      <form onSubmit={handleSubmit} aria-busy={loading || undefined}>
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
            'parle-chat-input__bar',
            !micAvailable && 'parle-chat-input__bar--no-mic',
            'bg-card border border-border/80',
            'shadow-[0_1px_6px_rgba(0,0,0,0.06)]',
            'focus-within:border-border transition',
          )}
        >
          <button
            type="button"
            onClick={handleAttachClick}
            disabled={disabled || attachments.length >= MAX_IMAGES}
            className="parle-chat-input__attach parle-chat-input__icon-btn h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground grid place-items-center transition disabled:opacity-40"
            aria-label="Attach image"
          >
            <Plus size={22} strokeWidth={1.75} />
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
            className="parle-chat-input__textarea resize-none bg-transparent border-0 outline-none leading-relaxed placeholder:text-muted-foreground/50 min-w-0 py-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            disabled={disabled}
          />

          <div className="relative shrink-0 parle-mode-selector parle-chat-input__mode">
            <button
              ref={modeButtonRef}
              type="button"
              onClick={() => setModeOpen((o) => !o)}
              disabled={disabled}
              className={cn(
                'parle-chat-input__mode-trigger',
                getModePillClasses(modeId, { selected: true, compact: true, filled: true }),
              )}
              aria-expanded={modeOpen}
              aria-haspopup="listbox"
              aria-label={`Conversation mode: ${getModeShortLabel(modeId)}`}
            >
              <span className="parle-mode-selector__label">{getModeShortLabel(modeId)}</span>
              <ChevronDown
                size={14}
                strokeWidth={2}
                className={cn('parle-mode-selector__chevron', modeOpen && 'parle-mode-selector__chevron--open')}
                aria-hidden
              />
            </button>
            {modeOpen && (
              <ModePillSelector
                activeModeId={modeId}
                anchorRef={modeButtonRef}
                sheet={isMobileSheet}
                onClose={() => setModeOpen(false)}
                onSelect={(mode) => {
                  setModeOpen(false)
                  onModeChange(mode)
                }}
              />
            )}
          </div>

          {micAvailable ? (
            <button
              type="button"
              onClick={toggleMic}
              disabled={disabled}
              className={cn(
                'parle-chat-input__mic parle-chat-input__icon-btn relative h-9 w-9 shrink-0 grid place-items-center transition rounded-full',
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
              <Mic size={20} strokeWidth={1.75} className="relative z-[1]" />
            </button>
          ) : (
            <span className="parle-chat-input__mic parle-chat-input__mic--placeholder" aria-hidden />
          )}

          <button
            type="submit"
            className={cn(
              'parle-chat-input__send parle-chat-send-btn shrink-0',
              loading || canSend ? 'parle-chat-send-btn--active' : 'parle-chat-send-btn--idle',
            )}
            disabled={loading || !canSend}
            aria-label={loading ? 'Waiting for response' : 'Send'}
          >
            {loading ? (
              <Loader2 size={18} strokeWidth={2.25} className="animate-spin" />
            ) : (
              <ArrowUp size={18} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </form>

      {showDisclaimer && (
        <p className="mt-2 text-center text-[9px] italic text-muted-foreground opacity-[0.35] leading-relaxed px-2">
          parlé can make mistakes. This is not a substitute for professional help.
        </p>
      )}

      {showConsentModal && (
        <HavenModal onClose={() => setShowConsentModal(false)} small>
          <h2 className="font-serif text-[18px] text-foreground">Before you attach an image</h2>
          <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
            Screenshots may contain private conversations belonging to other people. By attaching,
            you confirm the content is yours to share and you understand parlé&apos;s AI will read
            it to help support you.
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">
            This is not stored beyond your current session.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleConsentContinue}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-[11px] hover:opacity-90 transition"
            >
              I understand, continue
            </button>
            <button
              type="button"
              onClick={() => setShowConsentModal(false)}
              className="h-10 px-4 rounded-xl border border-border text-[11px] text-muted-foreground hover:text-foreground transition"
            >
              Cancel
            </button>
          </div>
        </HavenModal>
      )}
    </div>
  )
}
