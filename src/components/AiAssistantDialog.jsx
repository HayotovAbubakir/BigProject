import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Dialog,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import MicIcon from '@mui/icons-material/Mic'
import StopIcon from '@mui/icons-material/Stop'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import SendIcon from '@mui/icons-material/Send'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { useApp } from '../context/useApp'
import { useAuth } from '../hooks/useAuth'
import { useNotification } from '../context/NotificationContext'
import { useLocale } from '../context/LocaleContext'
import useExchangeRate from '../hooks/useExchangeRate'
import { executeAiActions } from '../utils/aiActionExecutor'
import { parseAiCommandLocally, resolveAiDraft } from '../utils/aiCommandUtils'

const EXAMPLES = [
  'Ombordan 1 ta elektrod chaqmoq 3 razmer sotilsin narxi 50000 UZS dan',
  "Do'kondan 2 dona luga sotilsin narxi 45000 UZS",
  'Sell 1 piece electrode chaqmoq size 3 from warehouse for 50000 UZS',
  'Yangi mijoz qo\'shish: Mirjalol Abdullayev, +998901234567',
  'Omborga 100 dona elektrod qabul qilinsin narxi 30000 UZS',
]

const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

const getSourceLabel = (source) => {
  if (source === 'warehouse') return 'Ombor'
  if (source === 'store') return "Do'kon"
  return 'Aniqlanmagan'
}

const getActionTypeLabel = (actionType) => {
  const labels = {
    sell_product: 'Mahsulot sotildi',
    receive_goods: 'Mahsulot qabul qilindi',
    adjust_inventory: 'Inventar sozlandi',
    add_client: 'Mijoz qo\'shildi',
    update_client: 'Mijoz o\'zgartirildi',
    delete_client: 'Mijozni o\'chirish',
    add_product: 'Mahsulot qo\'shildi',
    update_product: 'Mahsulot o\'zgartirildi',
    delete_product: 'Mahsulot o\'chirildi',
    add_credit: 'Qarz qo\'shildi',
    delete_credit: 'Qarz o\'chirildi',
  }
  return labels[actionType] || actionType
}

export default function AiAssistantDialog({ open, onClose }) {
  const { state, dispatch } = useApp()
  const { username } = useAuth()
  const { notify } = useNotification()
  const { locale } = useLocale()
  const { rate: usdToUzs } = useExchangeRate()

  const [command, setCommand] = useState('')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [assistantSource, setAssistantSource] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [resolution, setResolution] = useState(null)
  const [errorText, setErrorText] = useState('')
  const recognitionRef = useRef(null)

  const speechSupported = useMemo(() => !!getSpeechRecognition(), [])

  const resetDialog = () => {
    setCommand('')
    setLiveTranscript('')
    setAssistantSource('')
    setIsListening(false)
    setIsParsing(false)
    setIsExecuting(false)
    setResolution(null)
    setErrorText('')
  }

  useEffect(() => {
    if (!open) {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      resetDialog()
    }
  }, [open])

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
    setLiveTranscript('')
  }

  const startListening = () => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      notify('Mikrofon', "Brauzer ovozni matnga aylantirishni qo'llamaydi.", 'warning')
      return
    }

    stopListening()

    const recognition = new SpeechRecognition()
    recognition.lang = locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'uz-UZ'
    recognition.interimResults = true
    recognition.continuous = false

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0]?.transcript || ''
        if (event.results[i].isFinal) finalText += `${text} `
        else interimText += `${text} `
      }

      if (finalText.trim()) {
        setCommand((prev) => `${prev}${prev ? ' ' : ''}${finalText.trim()}`.trim())
      }
      setLiveTranscript(interimText.trim())
    }

    recognition.onerror = (event) => {
      setIsListening(false)
      setLiveTranscript('')
      if (event.error !== 'aborted') {
        notify('Mikrofon', `Ovoz yozishda xato: ${event.error}`, 'error')
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      setLiveTranscript('')
      recognitionRef.current = null
    }

    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
  }

  const requestAiDraft = async () => {
    const response = await fetch('/api/ai-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command,
        locale,
        username,
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload?.error || 'AI xizmati javob bermadi.')
    }

    return response.json()
  }

  const analyzeCommand = async () => {
    const trimmed = command.trim()
    if (!trimmed) {
      setErrorText('Avval buyruq yozing yoki gapiring.')
      return
    }

    setErrorText('')
    setIsParsing(true)

    try {
      let draft
      let sourceLabel = 'ai'

      try {
        const remote = await requestAiDraft()
        draft = remote?.command || remote
      } catch (error) {
        console.warn('AI draft failed, using local parser:', error.message)
        draft = parseAiCommandLocally(trimmed)
        sourceLabel = 'local_fallback'
      }

      const nextResolution = resolveAiDraft(draft, {
        warehouse: state.warehouse,
        store: state.store,
      })

      setResolution(nextResolution)
      setAssistantSource(sourceLabel)
    } catch (error) {
      setResolution(null)
      setErrorText(error.message || "Buyruqni tushunib bo'lmadi.")
    } finally {
      setIsParsing(false)
    }
  }

  const confirmActions = async () => {
    if (!resolution?.canConfirm || isExecuting) return

    setIsExecuting(true)
    try {
      const result = await executeAiActions({
        actions: resolution.readyActions.map(entry => entry.action),
        username,
        exchangeRate: usdToUzs,
        dispatch,
        actionType: 'mixed', // Support all action types
      })

      notify('AI Operator', `${result.count} ta amal saqlandi.`, 'success')
      resetDialog()
      onClose()
    } catch (error) {
      setErrorText(error.message || "AI amallarini saqlab bo'lmadi.")
      notify('AI Operator', error.message || "AI amallarini saqlab bo'lmadi.", 'error')
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <AppBar sx={{ position: 'relative' }}>
        <Toolbar>
          <SmartToyIcon sx={{ mr: 1.5 }} />
          <Typography sx={{ flex: 1, fontWeight: 700 }} variant="h6">
            AI Operator
          </Typography>
          <Button color="inherit" startIcon={<RestartAltIcon />} onClick={resetDialog}>
            Tozalash
          </Button>
          <IconButton edge="end" color="inherit" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: 2, maxWidth: 1200, width: '100%', mx: 'auto' }}>
        <Paper variant="outlined" sx={{ p: 2.5, display: 'grid', gap: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-start' }}>
            <Box sx={{ flex: 1, display: 'grid', gap: 1.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Ovoz yoki matn orqali buyruq bering
              </Typography>
              <Typography color="text.secondary">
                Uzbek, Russian yoki Englishda gapiring. AI sayt bo'ylab buyruqlarni bajaradi: sotilsin, qabul qilish, mijozlarni boshqarish, mahsulot qo'shish, kredit va boshqalarga.
              </Typography>

              <TextField
                multiline
                minRows={4}
                maxRows={8}
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="Masalan: Ombordan 1 ta elektrod chaqmoq 3 razmer sotilsin narxi 50000 UZS dan | Yangi mijoz qo'shish: Mirjalol"
                fullWidth
              />

              {liveTranscript && <Alert severity="info">Eshitilyapti: {liveTranscript}</Alert>}
              {errorText && <Alert severity="error">{errorText}</Alert>}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  variant={isListening ? 'outlined' : 'contained'}
                  color={isListening ? 'warning' : 'primary'}
                  startIcon={isListening ? <StopIcon /> : <MicIcon />}
                  onClick={isListening ? stopListening : startListening}
                  disabled={!speechSupported && !isListening}
                >
                  {isListening ? "To'xtatish" : 'Mikrofon'}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={analyzeCommand}
                  disabled={isParsing || isExecuting}
                >
                  {isParsing ? 'Tushunilyapti...' : 'AI ga yuborish'}
                </Button>
              </Stack>

              {!speechSupported && (
                <Typography variant="caption" color="text.secondary">
                  Bu brauzer SpeechRecognition ni qo'llamayapti. Matn bilan davom etsa bo'ladi.
                </Typography>
              )}
            </Box>

            <Paper
              variant="outlined"
              sx={{
                width: { xs: '100%', md: 360 },
                p: 2,
                background: 'linear-gradient(180deg, rgba(25,118,210,0.08) 0%, rgba(25,118,210,0.02) 100%)',
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 1 }}>Misollar</Typography>
              <Stack spacing={1}>
                {EXAMPLES.map((example) => (
                  <Button
                    key={example}
                    variant="text"
                    sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                    onClick={() => setCommand(example)}
                  >
                    {example}
                  </Button>
                ))}
              </Stack>
            </Paper>
          </Stack>
        </Paper>

        {resolution && (
          <Paper variant="outlined" sx={{ p: 2.5, display: 'grid', gap: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  Tasdiqlash oynasi
                </Typography>
                <Typography color="text.secondary">
                  {resolution.summary || 'AI quyidagi amallarni tayyorladi.'}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                {assistantSource && (
                  <Chip
                    label={assistantSource === 'local_fallback' ? 'Local fallback parser' : 'OpenAI parser'}
                    color={assistantSource === 'local_fallback' ? 'warning' : 'success'}
                    variant="outlined"
                  />
                )}
                <Chip
                  label={resolution.canConfirm ? 'Tayyor' : 'Aniqlashtirish kerak'}
                  color={resolution.canConfirm ? 'success' : 'warning'}
                />
              </Stack>
            </Stack>

            <Divider />

            <Stack spacing={1.5}>
              {resolution.resolvedActions.map((entry) => (
                <Paper key={`${entry.index}-${entry.preview?.displayName || entry.issue}`} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between">
                    <Box sx={{ display: 'grid', gap: 0.5, flex: 1 }}>
                      <Typography sx={{ fontWeight: 700 }}>
                        {entry.preview?.displayName || entry.action?.product_query?.name || 'Amal'}
                      </Typography>

                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {/* Show action type */}
                        <Chip size="small" label={getActionTypeLabel(entry.action?.type)} color="info" variant="outlined" />

                        {/* For sell_product and adjust_inventory: show source */}
                        {(entry.action?.type === 'sell_product' || entry.action?.type === 'adjust_inventory') && entry.action?.source && (
                          <Chip size="small" label={getSourceLabel(entry.action?.source)} variant="outlined" />
                        )}

                        {/* For receive_goods: show location */}
                        {entry.action?.type === 'receive_goods' && entry.action?.location && (
                          <Chip size="small" label={`Joylashuv: ${getSourceLabel(entry.action?.location)}`} variant="outlined" />
                        )}

                        {/* For sell_product, receive_goods, adjust_inventory: show quantity and price */}
                        {(entry.action?.type === 'sell_product' || entry.action?.type === 'receive_goods' || entry.action?.type === 'adjust_inventory') && (
                          <>
                            <Chip size="small" label={`${entry.action?.quantity} ${entry.action?.unit || 'dona'}`} />
                            {entry.action?.unit_price && (
                              <Chip size="small" label={`${entry.action?.unit_price} ${entry.action?.currency || 'UZS'}`} />
                            )}
                          </>
                        )}

                        {/* For client operations */}
                        {entry.action?.type === 'add_client' && entry.action?.client_phone && (
                          <Chip size="small" label={`Tel: ${entry.action?.client_phone}`} variant="outlined" />
                        )}

                        {/* For credit operations */}
                        {entry.action?.type === 'add_credit' && (
                          <>
                            {entry.action?.amount && (
                              <Chip size="small" label={`${entry.action?.amount} ${entry.action?.currency || 'UZS'}`} />
                            )}
                            {entry.action?.qty && (
                              <Chip size="small" label={`${entry.action?.qty} dona`} />
                            )}
                          </>
                        )}
                      </Stack>

                      {/* Available quantity for sell_product */}
                      {entry.preview?.available != null && entry.action?.type === 'sell_product' && (
                        <Typography variant="caption" color="text.secondary">
                          Mavjud: {entry.preview.available} {entry.action?.unit || 'dona'}
                        </Typography>
                      )}
                    </Box>

                    <Chip
                      label={entry.status === 'ready' ? 'Tayyor' : entry.status === 'ambiguous' ? 'Noaniq' : 'Muammo'}
                      color={entry.status === 'ready' ? 'success' : 'warning'}
                    />
                  </Stack>

                  {entry.issue && (
                    <Alert severity={entry.status === 'missing' ? 'error' : 'warning'} sx={{ mt: 1.5 }}>
                      {entry.issue}
                    </Alert>
                  )}

                  {Array.isArray(entry.candidates) && entry.candidates.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap">
                      {entry.candidates.map((candidate) => (
                        <Chip
                          key={`${candidate.source}-${candidate.name}`}
                          label={`${getSourceLabel(candidate.source)}: ${candidate.name}`}
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  )}
                </Paper>
              ))}
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
              <Button variant="outlined" onClick={resetDialog}>
                Qayta yozish
              </Button>
              <Button
                variant="contained"
                startIcon={<CheckCircleIcon />}
                onClick={confirmActions}
                disabled={!resolution.canConfirm || isExecuting}
              >
                {isExecuting ? 'Saqlanmoqda...' : 'Tasdiqlash va saqlash'}
              </Button>
            </Stack>
          </Paper>
        )}
      </Box>
    </Dialog>
  )
}
