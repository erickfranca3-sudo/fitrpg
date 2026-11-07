Add-Type -AssemblyName System.Drawing

function Generate-AppIcon([int]$size, [string]$outPath) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background gradient
    $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.ColorTranslator]::FromHtml('#0a1b52')), ([System.Drawing.ColorTranslator]::FromHtml('#030717')), 90
    $g.FillRectangle($bgBrush, $rect)
    $bgBrush.Dispose()

    # Inner aura radial glow
    $glowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70, 0, 210, 255))
    $glowRect = New-Object System.Drawing.Rectangle ([int]($size * 0.15)), ([int]($size * 0.15)), ([int]($size * 0.7)), ([int]($size * 0.7))
    $g.FillEllipse($glowBrush, $glowRect)
    $glowBrush.Dispose()

    # Draw Avatar (av10.png)
    $avPath = 'd:\FITRPG\assets\av10.png'
    if (Test-Path $avPath) {
        $av = [System.Drawing.Image]::FromFile($avPath)
        $targetH = [int]($size * 0.78)
        $targetW = [int]($av.Width * ($targetH / $av.Height))
        $targetX = [int](($size - $targetW) / 2)
        $targetY = [int]($size * 0.12)
        $g.DrawImage($av, $targetX, $targetY, $targetW, $targetH)
        $av.Dispose()
    }

    # Gold/Cyan frame border
    $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#00d2ff')), ([float]($size * 0.035))
    $borderRect = New-Object System.Drawing.Rectangle ([int]($size * 0.02)), ([int]($size * 0.02)), ([int]($size * 0.96)), ([int]($size * 0.96))
    $g.DrawRectangle($pen, $borderRect)
    $pen.Dispose()

    # Save PNG
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

Generate-AppIcon 192 'd:\FITRPG\assets\icon-192.png'
Generate-AppIcon 512 'd:\FITRPG\assets\icon-512.png'
Write-Host "Icons generated successfully!"
