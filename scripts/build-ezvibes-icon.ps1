param(
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\renderer\ezvibes.ico')
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$sizes = @(16, 24, 32, 48, 64, 128, 256)

function New-EzvibesBitmap {
  param([int]$Size)

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $pad = [Math]::Max(1, [int]($Size * 0.06))
  $tabH = [Math]::Max(2, [int]($Size * 0.16))
  $tabW = [Math]::Max(4, [int]($Size * 0.42))
  $faceTop = $tabH - [int]($Size * 0.04)
  $faceLeft = $pad
  $faceRight = $Size - $pad
  $faceBottom = $Size - $pad
  $faceWidth = $faceRight - $faceLeft
  $faceHeight = $faceBottom - $faceTop
  $cornerRadius = [Math]::Max(1, [int]($Size * 0.08))

  $tabColor       = [System.Drawing.Color]::FromArgb(217, 169, 58)   # #D9A93A
  $faceTopColor   = [System.Drawing.Color]::FromArgb(245, 194, 74)   # #F5C24A
  $faceBottomColor = [System.Drawing.Color]::FromArgb(224, 168, 40)  # #E0A828
  $outlineColor   = [System.Drawing.Color]::FromArgb(138, 96, 32)    # #8A6020
  $flatColor      = [System.Drawing.Color]::FromArgb(237, 184, 64)   # #EDB840
  $outlineWidth   = if ($Size -ge 64) { [single]1.5 } else { [single]1.0 }

  # Folder back tab
  $tabRect = New-Object System.Drawing.Rectangle($faceLeft, $pad, $tabW, $tabH)
  $tabBrush = New-Object System.Drawing.SolidBrush($tabColor)
  $g.FillRectangle($tabBrush, $tabRect)
  $outlinePen = New-Object System.Drawing.Pen($outlineColor, $outlineWidth)
  $g.DrawRectangle($outlinePen, $tabRect)
  $tabBrush.Dispose()

  # Folder front face
  $faceRect = New-Object System.Drawing.Rectangle($faceLeft, $faceTop, $faceWidth, $faceHeight)
  if ($Size -le 24) {
    $faceBrush = New-Object System.Drawing.SolidBrush($flatColor)
    $g.FillRectangle($faceBrush, $faceRect)
    $g.DrawRectangle($outlinePen, $faceRect)
    $faceBrush.Dispose()
  } else {
    $faceBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      $faceRect,
      $faceTopColor,
      $faceBottomColor,
      [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $cornerRadius * 2
    $path.AddArc($faceLeft, $faceTop, $d, $d, 180, 90)
    $path.AddArc($faceRight - $d, $faceTop, $d, $d, 270, 90)
    $path.AddArc($faceRight - $d, $faceBottom - $d, $d, $d, 0, 90)
    $path.AddArc($faceLeft, $faceBottom - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $g.FillPath($faceBrush, $path)
    $g.DrawPath($outlinePen, $path)
    $faceBrush.Dispose()
    $path.Dispose()
  }
  $outlinePen.Dispose()

  # Black "Z" glyph
  $fontNames = @('Segoe UI Black', 'Arial Black', 'Impact')
  $font = $null
  $fontSize = [single]([Math]::Max(6, [int]($faceHeight * 0.62)))
  foreach ($name in $fontNames) {
    try {
      $candidate = New-Object System.Drawing.Font($name, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      if ($candidate.Name -eq $name) { $font = $candidate; break }
      $candidate.Dispose()
    } catch {}
  }
  if (-not $font) {
    $font = New-Object System.Drawing.Font([System.Drawing.FontFamily]::GenericSansSerif, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  }

  $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  # PS 5.1 overload pick: passing Rectangle resolves to DrawString(..., PointF, ...); force RectangleF for the layout-rectangle overload.
  $faceRectF = [System.Drawing.RectangleF]::new($faceRect.X, $faceRect.Y, $faceRect.Width, $faceRect.Height)
  $g.DrawString('Z', $font, $textBrush, $faceRectF, $sf)
  $font.Dispose()
  $textBrush.Dispose()
  $sf.Dispose()
  $g.Dispose()

  return $bmp
}

function Get-PngBytes {
  param([System.Drawing.Bitmap]$Bitmap)
  $ms = New-Object System.IO.MemoryStream
  $Bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $ms.ToArray()
  $ms.Dispose()
  return ,$bytes
}

$payloads = @()
foreach ($size in $sizes) {
  $bmp = New-EzvibesBitmap -Size $size
  $bytes = Get-PngBytes -Bitmap $bmp
  $payloads += [PSCustomObject]@{ Size = $size; Bytes = $bytes }
  $bmp.Dispose()
}

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$count = $payloads.Count
$headerSize = 6
$entrySize = 16
$dataOffset = $headerSize + ($entrySize * $count)

# ICONDIR
$bw.Write([uint16]0)        # Reserved = 0
$bw.Write([uint16]1)        # Type = 1 (ICO)
$bw.Write([uint16]$count)   # Count

# ICONDIRENTRYs
$currentOffset = $dataOffset
foreach ($p in $payloads) {
  $w = if ($p.Size -ge 256) { [byte]0 } else { [byte]$p.Size }
  $h = $w
  $bw.Write($w)                         # Width
  $bw.Write($h)                         # Height
  $bw.Write([byte]0)                    # ColorCount
  $bw.Write([byte]0)                    # Reserved
  $bw.Write([uint16]1)                  # Planes
  $bw.Write([uint16]32)                 # BitCount
  $bw.Write([uint32]$p.Bytes.Length)    # BytesInRes
  $bw.Write([uint32]$currentOffset)     # ImageOffset
  $currentOffset += $p.Bytes.Length
}

# Image payloads (PNG-in-ICO; supported by Vista+)
foreach ($p in $payloads) {
  $bw.Write($p.Bytes)
}

$bw.Flush()
$bytes = $ms.ToArray()
$bw.Dispose()
$ms.Dispose()

$outDir = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outDir)) {
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

[System.IO.File]::WriteAllBytes($OutputPath, $bytes)
Write-Host "Wrote $($bytes.Length) bytes to $OutputPath"
