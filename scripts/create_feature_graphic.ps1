[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing

$width = 1024
$height = 500
$bmp = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Background dark gradient
$rect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 10, 11, 15)), ([System.Drawing.Color]::FromArgb(255, 18, 20, 28)), 45.0
$g.FillRectangle($brush, $rect)

# Ambient glow (radial orange/gold glow on right)
$pathGlow = New-Object System.Drawing.Drawing2D.GraphicsPath
$pathGlow.AddEllipse(450, -100, 750, 700)
$pbr = New-Object System.Drawing.Drawing2D.PathGradientBrush $pathGlow
$pbr.CenterColor = [System.Drawing.Color]::FromArgb(45, 230, 160, 45)
$pbr.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 10, 11, 15))
$g.FillEllipse($pbr, 450, -100, 750, 700)

# Function to draw rounded rectangle
function Add-RoundedRect($path, $x, $y, $w, $h, $r) {
    $d = $r * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
}

# Icon position
$iconX = 75
$iconY = 120
$iconSize = 260
$radius = 52

# Draw icon shadow
$shadowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
Add-RoundedRect $shadowPath ($iconX - 4) ($iconY + 6) ($iconSize + 8) ($iconSize + 8) $radius
$shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(80, 0, 0, 0))
$g.FillPath($shadowBrush, $shadowPath)

# Draw rounded icon
$iconPath = "assets\play_store_icon_512.png"
if (Test-Path $iconPath) {
    $icon = [System.Drawing.Image]::FromFile($iconPath)
    $iconClip = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundedRect $iconClip $iconX $iconY $iconSize $iconSize $radius
    
    $oldClip = $g.Clip
    $g.SetClip($iconClip)
    $g.DrawImage($icon, $iconX, $iconY, $iconSize, $iconSize)
    $g.Clip = $oldClip
    $icon.Dispose()
    
    # Outer stroke for icon
    $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(40, 255, 255, 255)), 2
    $g.DrawPath($borderPen, $iconClip)
}

# Typography
$fontTitle = [System.Drawing.Font]::new("Segoe UI", [float]66.0, [System.Drawing.FontStyle]::Bold)
$brushWhite = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
$g.DrawString("SPOT", $fontTitle, $brushWhite, ([float]380.0), ([float]110.0))

$fontTag = [System.Drawing.Font]::new("Segoe UI", [float]18.0, [System.Drawing.FontStyle]::Bold)
$brushAmber = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 166, 35))
$g.DrawString("ТРЕНУЙСЯ ПО-СВОЄМУ. SPOT ФІКСУЄ ВСЕ.", $fontTag, $brushAmber, ([float]385.0), ([float]212.0))

$fontSub = [System.Drawing.Font]::new("Segoe UI", [float]14.5, [System.Drawing.FontStyle]::Regular)
$brushGray = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 175, 180, 195))
$g.DrawString("Мінімалістичний щоденник тренувань • Розумний таймер • Прогрес", $fontSub, $brushGray, ([float]387.0), ([float]262.0))

# Badges (Pills)
$badges = @("БЕЗ РЕКЛАМИ", "ПРАЦЮЄ ОФЛАЙН", "ВАШ ПРОГРЕС")
$bx = 387
$by = 325
$fontBadge = [System.Drawing.Font]::new("Segoe UI", [float]10.0, [System.Drawing.FontStyle]::Bold)
$brushBadgeBg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(35, 255, 255, 255))
$penBadgeBorder = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, 255, 255, 255)), 1

foreach($b in $badges) {
    $size = $g.MeasureString($b, $fontBadge)
    $bw = [int]($size.Width + 24)
    $bh = 32
    $badgePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundedRect $badgePath $bx $by $bw $bh 8
    $g.FillPath($brushBadgeBg, $badgePath)
    $g.DrawPath($penBadgeBorder, $badgePath)
    $g.DrawString($b, $fontBadge, $brushWhite, ([float]($bx + 12)), ([float]($by + 7)))
    $bx += $bw + 12
}

$destPath = "assets\play_store_feature_graphic_1024x500.png"
$bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
Write-Host "Success: generated 1024x500 at $destPath"
