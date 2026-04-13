# Generates PWA icon sizes from public/vasta-logo.png without introducing alternative logos.

Add-Type -AssemblyName System.Drawing

$SourcePath = Join-Path (Join-Path $PSScriptRoot '..') (Join-Path 'public' 'vasta-logo.png')
$OutputDir = Join-Path (Join-Path $PSScriptRoot '..') (Join-Path 'public' 'icons')

if (-not (Test-Path $SourcePath)) {
  Write-Error "Source logo not found at $SourcePath"
  exit 1
}

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$logo = [Drawing.Image]::FromFile($SourcePath)

$targets = @(
  @{ Path = 'icon-192.png'; Size = 192; Maskable = $false },
  @{ Path = 'icon-512.png'; Size = 512; Maskable = $false },
  @{ Path = 'icon-maskable-192.png'; Size = 192; Maskable = $true },
  @{ Path = 'icon-maskable-512.png'; Size = 512; Maskable = $true }
)

foreach ($t in $targets) {
  $canvasSize = $t.Size
  $bitmap = New-Object Drawing.Bitmap $canvasSize, $canvasSize
  $g = [Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

  if ($t.Maskable) {
    # Solid background to keep maskable safe area intact.
    $g.Clear([Drawing.Color]::FromArgb(255, 0, 0, 0))
    $padding = 0.18 * $canvasSize
  } else {
    # Transparent background for standard icons.
    $g.Clear([Drawing.Color]::FromArgb(0, 0, 0, 0))
    $padding = 0.1 * $canvasSize
  }

  $maxInner = $canvasSize - (2 * $padding)
  $scale = [Math]::Min($maxInner / $logo.Width, $maxInner / $logo.Height)
  $w = [Math]::Round($logo.Width * $scale)
  $h = [Math]::Round($logo.Height * $scale)
  $x = [Math]::Round(($canvasSize - $w) / 2)
  $y = [Math]::Round(($canvasSize - $h) / 2)

  $g.DrawImage($logo, $x, $y, $w, $h)

  $outPath = Join-Path $OutputDir $t.Path
  $bitmap.Save($outPath, [Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose()
  $bitmap.Dispose()
  Write-Host \"Wrote $outPath\"
}

$logo.Dispose()
