import React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography, Alert, IconButton, Tooltip } from '@mui/material'
import TelegramIcon from '@mui/icons-material/Telegram'
import EmailIcon from '@mui/icons-material/Email'
import GitHubIcon from '@mui/icons-material/GitHub'
import LinkedInIcon from '@mui/icons-material/LinkedIn'
import { useAuth } from '../hooks/useAuth'
import { useLocale } from '../context/LocaleContext'
import { supabase } from '/supabase/supabaseClient'

export default function ContactDialog({ open, onClose }) {
  const { username, authUser } = useAuth()
  const { t } = useLocale()
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [email, setEmail] = React.useState(authUser?.email || '')
  const [message, setMessage] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [status, setStatus] = React.useState(null)

  React.useEffect(() => {
    if (open) {
      setFirstName('')
      setLastName('')
      setEmail(authUser?.email || '')
      setMessage('')
      setStatus(null)
      setLoading(false)
    }
  }, [open, authUser])

  const targetEmail = 'hayotovabubakir@gmail.com'
  const telegram = '@abucha_o8'

  const resetForm = () => {
    setFirstName('')
    setLastName('')
    setEmail(authUser?.email || '')
    setMessage('')
  }

  const handleSend = async () => {
    if (!message || !email) {
      setStatus({ ok: false, msg: 'Iltimos email va izohni toʻldiring' })
      return
    }
    setLoading(true)
    setStatus(null)

    const subject = encodeURIComponent(`Kontakt: ${firstName} ${lastName}`)
    const bodyLines = [
      `Sender: ${firstName} ${lastName}`,
      `Username: ${username || 'anonymous'}`,
      `Email: ${email}`,
      '',
      message
    ]
    const body = encodeURIComponent(bodyLines.join('\n'))

    // Try to invoke a Supabase edge function if available (best-effort)
    try {
      if (supabase && supabase.functions && supabase.functions.invoke) {
        try {
          const { error } = await supabase.functions.invoke('send-contact-email', {
            body: JSON.stringify({ to: targetEmail, subject: `Kontakt: ${firstName} ${lastName}`, body: bodyLines.join('\n') })
          })
          if (error) throw error
          setStatus({ ok: true, msg: 'Xabar yuborildi' })
          resetForm()
          setLoading(false)
          return
        } catch (err) {
          // function likely doesn't exist or failed — fall back to mailto
          console.debug('send-contact-email function failed:', err)
        }
      }
    } catch (err) {
      console.debug('Supabase function check failed:', err)
    }

    // Fallback: open mail client using mailto
    try {
      const mailto = `mailto:${targetEmail}?subject=${subject}&body=${body}`
      window.location.href = mailto
      setStatus({ ok: true, msg: 'Email client ochildi' })
      resetForm()
    } catch (_err) {
      void _err
      setStatus({ ok: false, msg: 'Xabar yuborishda xatolik yuz berdi' })
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Contact</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Tooltip title="Open Telegram">
            <IconButton component="a" href="https://t.me/abucha_o8" target="_blank" rel="noopener noreferrer" color="primary" sx={{ fontSize: '2rem' }}>
              <TelegramIcon sx={{ fontSize: 'inherit' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Send Email">
            <IconButton component="a" href="mailto:hayotovabubakir@gmail.com" color="primary" sx={{ fontSize: '2rem' }}>
              <EmailIcon sx={{ fontSize: 'inherit' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Visit GitHub">
            <IconButton component="a" href="https://github.com/HayotovAbubakir" target="_blank" rel="noopener noreferrer" color="primary" sx={{ fontSize: '2rem' }}>
              <GitHubIcon sx={{ fontSize: 'inherit' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Visit LinkedIn">
            <IconButton component="a" href="https://www.linkedin.com/in/abubakir-hayotov-858a84366/" target="_blank" rel="noopener noreferrer" color="primary" sx={{ fontSize: '2rem' }}>
              <LinkedInIcon sx={{ fontSize: 'inherit' }} />
            </IconButton>
          </Tooltip>
        </Box>

        {status && (
          <Alert severity={status.ok ? 'success' : 'error'} sx={{ mb: 2 }}>{status.msg}</Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
          <TextField label={t('name') || 'Ism'} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <TextField label={t('surname') || 'Familya'} value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Box>

        <TextField fullWidth label={t('email') || 'Email'} value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 1 }} />
        <TextField fullWidth label={t('message') || 'Izoh'} multiline minRows={4} value={message} onChange={(e) => setMessage(e.target.value)} sx={{ mb: 1 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Yopish</Button>
        <Button variant="contained" onClick={handleSend} disabled={loading}>{loading ? 'Yuborilmoqda...' : 'Send'}</Button>
      </DialogActions>
    </Dialog>
  )
}
