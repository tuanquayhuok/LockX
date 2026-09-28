Add-Type -AssemblyName System.Drawing

$size = 1024
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Background: Deep Apple Midnight Obsidian
$rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$bgP1 = New-Object System.Drawing.PointF(0.0, 0.0)
$bgP2 = New-Object System.Drawing.PointF([float]$size, [float]$size)
$bgColor1 = [System.Drawing.ColorTranslator]::FromHtml("#050811")
$bgColor2 = [System.Drawing.ColorTranslator]::FromHtml("#0A1120")
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bgP1, $bgP2, $bgColor1, $bgColor2)
$g.FillRectangle($bgBrush, $rect)

# Draw Rounded Squircle Base (Apple iOS App Icon Superellipse style)
$radius = 210.0
$pad = 70.0
$w = [float]($size - ($pad * 2))
$h = [float]($size - ($pad * 2))
$r2 = [float]($radius * 2)

$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc([float]$pad, [float]$pad, $r2, $r2, 180.0, 90.0)
$path.AddArc([float]($pad + $w - $r2), [float]$pad, $r2, $r2, 270.0, 90.0)
$path.AddArc([float]($pad + $w - $r2), [float]($pad + $h - $r2), $r2, $r2, 0.0, 90.0)
$path.AddArc([float]$pad, [float]($pad + $h - $r2), $r2, $r2, 90.0, 90.0)
$path.CloseFigure()

# Inner Icon Background Gradient
$sqP1 = New-Object System.Drawing.PointF([float]$pad, [float]$pad)
$sqP2 = New-Object System.Drawing.PointF([float]($pad + $w), [float]($pad + $h))
$sqColor1 = [System.Drawing.ColorTranslator]::FromHtml("#0E1B33")
$sqColor2 = [System.Drawing.ColorTranslator]::FromHtml("#060C17")
$squircleBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($sqP1, $sqP2, $sqColor1, $sqColor2)
$g.FillPath($squircleBrush, $path)

# Subtle Glass Border
$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 10, 132, 255), 6.0)
$g.DrawPath($borderPen, $path)

# Lock Shackle (Curved Apple Stainless Steel Arc)
$shacklePen = New-Object System.Drawing.Pen(([System.Drawing.ColorTranslator]::FromHtml("#38BDF8")), 48.0)
$shacklePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$shacklePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$shacklePath = New-Object System.Drawing.Drawing2D.GraphicsPath
$shacklePath.AddArc(367.0, 235.0, 290.0, 290.0, 180.0, 180.0)
$g.DrawPath($shacklePen, $shacklePath)
$g.DrawLine($shacklePen, 367.0, 380.0, 367.0, 480.0)
$g.DrawLine($shacklePen, 657.0, 380.0, 657.0, 480.0)

# Vault Shield Body (Vibrant Apple Blue to Purple Indigo Gradient)
$bodyP1 = New-Object System.Drawing.PointF(290.0, 440.0)
$bodyP2 = New-Object System.Drawing.PointF(734.0, 820.0)
$bodyColor1 = [System.Drawing.ColorTranslator]::FromHtml("#0A84FF")
$bodyColor2 = [System.Drawing.ColorTranslator]::FromHtml("#5E5CE6")
$bodyBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bodyP1, $bodyP2, $bodyColor1, $bodyColor2)

$bodyRadius = 75.0
$bx = 290.0; $by = 440.0; $bw = 444.0; $bh = 380.0; $br2 = [float]($bodyRadius * 2)
$bp = New-Object System.Drawing.Drawing2D.GraphicsPath
$bp.AddArc($bx, $by, $br2, $br2, 180.0, 90.0)
$bp.AddArc([float]($bx + $bw - $br2), $by, $br2, $br2, 270.0, 90.0)
$bp.AddArc([float]($bx + $bw - $br2), [float]($by + $bh - $br2), $br2, $br2, 0.0, 90.0)
$bp.AddArc($bx, [float]($by + $bh - $br2), $br2, $br2, 90.0, 90.0)
$bp.CloseFigure()
$g.FillPath($bodyBrush, $bp)

# Sleek Glass Edge on Body
$bodyBorderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 255, 255, 255), 4.0)
$g.DrawPath($bodyBorderPen, $bp)

# The Iconic "X" Vault Cutout (White Precision Lines)
$xPen = New-Object System.Drawing.Pen(([System.Drawing.ColorTranslator]::FromHtml("#FFFFFF")), 40.0)
$xPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$xPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawLine($xPen, 437.0, 550.0, 587.0, 700.0)
$g.DrawLine($xPen, 587.0, 550.0, 437.0, 700.0)

# Center Vault Cyber Core Dot
$nodeBrush = New-Object System.Drawing.SolidBrush(([System.Drawing.ColorTranslator]::FromHtml("#0A84FF")))
$g.FillEllipse($nodeBrush, 477.0, 590.0, 70.0, 70.0)
$nodeBorder = New-Object System.Drawing.Pen(([System.Drawing.ColorTranslator]::FromHtml("#FFFFFF")), 9.0)
$g.DrawEllipse($nodeBorder, 477.0, 590.0, 70.0, 70.0)

$g.Dispose()

# Save Master 1024x1024 icon.png
$bmp.Save("D:\GVault-Expo\assets\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save("D:\GVault-Expo\assets\logo.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmp.Save("D:\GVault-Expo\assets\splash-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Generate Favicon (64x64)
$favBmp = New-Object System.Drawing.Bitmap(64, 64)
$fg = [System.Drawing.Graphics]::FromImage($favBmp)
$fg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$fg.DrawImage($bmp, 0, 0, 64, 64)
$fg.Dispose()
$favBmp.Save("D:\GVault-Expo\assets\favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$favBmp.Dispose()

# Generate Android Foreground (Adaptive icon)
$bmp.Save("D:\GVault-Expo\assets\android-icon-foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)

$bmp.Dispose()
Write-Output "Successfully generated all clean vector icons!"
