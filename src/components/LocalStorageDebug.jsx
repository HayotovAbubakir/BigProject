import React from 'react'
import { IconButton, Popover, Typography, Box } from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import { useApp } from '../context/useApp'

export default function LocalStorageDebug() {
  const [anchor, setAnchor] = React.useState(null)
  const open = Boolean(anchor)
  const handleOpen = (e) => setAnchor(e.currentTarget)
  const handleClose = () => setAnchor(null)

  const { state } = useApp()
  const data = state || null

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen} title="App State Debug">
        <StorageIcon />
      </IconButton>
      <Popover open={open} anchorEl={anchor} onClose={handleClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Box sx={{ p: 2, maxWidth: 420 }}>
          <Typography variant="subtitle2">App state (Supabase)</Typography>
          <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 12 }}>{JSON.stringify(data, null, 2) || 'null'}</pre>
        </Box>
      </Popover>
    </>
  )
}
