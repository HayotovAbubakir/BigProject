import React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, TextField, Alert, Box } from '@mui/material'
import { useAuth } from '../hooks/useAuth'

export default function MfaSetupDialog({ open, onClose }) {
  const { listMfaFactors, enrollMfa, challengeMfa, verifyMfa, session } = useAuth()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [status, setStatus] = React.useState('idle')
  const [qrCode, setQrCode] = React.useState('')
  const [secret, setSecret] = React.useState('')
  const [factorId, setFactorId] = React.useState('')
  const [code, setCode] = React.useState('')
  const [enabled, setEnabled] = React.useState(false)

  React.useEffect(() => {
    if (!open || !session) return
    let mounted = true
    setError('')
    setStatus('idle')
    setQrCode('')
    setSecret('')
    setFactorId('')

    ;(async () => {
      setLoading(true)
      if (!session) {
        setError('Auth session missing!')
        setLoading(false)
        return
      }
      const res = await listMfaFactors()
      if (!mounted) return
      if (!res.ok) {
        setError(res.error || 'Failed to load MFA status')
        setLoading(false)
        return
      }
      const factors = res.data?.totp || []
      const hasVerified = factors.some((f) => f.status === 'verified')
      setEnabled(hasVerified)
      setLoading(false)
    })()

    return () => { mounted = false }
  }, [open, session, listMfaFactors])

  const startEnroll = async () => {
    setError('')
    setLoading(true)
    if (!session) {
      setError('Auth session missing!')
      setLoading(false)
      return
    }
    const res = await enrollMfa()
    setLoading(false)
    if (!res.ok) {
      setError(res.error || 'Failed to start MFA enrollment')
      return
    }
    const factor = res.data
    setFactorId(factor?.id || '')
    setQrCode(factor?.totp?.qr_code || '')
    setSecret(factor?.totp?.secret || '')
    setStatus('verify')
  }

  const confirmCode = async () => {
    setError('')
    if (!factorId || !code) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setLoading(true)
    if (!session) {
      setError('Auth session missing!')
      setLoading(false)
      return
    }
    const challenge = await challengeMfa(factorId)
    if (!challenge.ok) {
      setLoading(false)
      setError(challenge.error || 'Failed to request MFA challenge')
      return
    }
    const challengeIdLocal = challenge.data?.id

    const verify = await verifyMfa(factorId, challengeIdLocal, code)
    setLoading(false)
    if (!verify.ok) {
      setError(verify.error || 'Verification failed')
      return
    }
    setEnabled(true)
    setStatus('done')
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Two-Factor Authentication</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {enabled && status === 'idle' && (
          <Alert severity="success" sx={{ mb: 2 }}>2FA is already enabled for your account.</Alert>
        )}

        {!enabled && status === 'idle' && (
          <Box>
            <Typography sx={{ mb: 2 }}>Enable 2FA to protect your account with a one-time code.</Typography>
            <Button variant="contained" onClick={startEnroll} disabled={loading}>Start 2FA Setup</Button>
          </Box>
        )}

        {status === 'verify' && (
          <Box>
            <Typography sx={{ mb: 1 }}>Scan this QR code in your authenticator app.</Typography>
            {qrCode ? (
              <Box sx={{ mb: 2 }}>
                {qrCode.startsWith('data:') ? (
                  <img src={qrCode} alt="MFA QR" style={{ maxWidth: '100%' }} />
                ) : (
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <div dangerouslySetInnerHTML={{ __html: qrCode }} />
                  </Box>
                )}
              </Box>
            ) : null}
            {secret && (
              <Typography variant="body2" sx={{ mb: 2 }}>Secret: <strong>{secret}</strong></Typography>
            )}
            <TextField
              fullWidth
              label="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Button variant="contained" onClick={confirmCode} disabled={loading}>Verify</Button>
          </Box>
        )}

        {status === 'done' && (
          <Alert severity="success">2FA enabled successfully.</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
