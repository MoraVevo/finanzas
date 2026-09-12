Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAliasGridFit'

    # Fondo: gradiente vertical verde-teal
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $c1 = [System.Drawing.Color]::FromArgb(255, 16, 140, 108)   # #0E8C6C
    $c2 = [System.Drawing.Color]::FromArgb(255, 32, 178, 140)   # #20B28C
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 90)
    $g.FillRectangle($brush, $rect)

    # Glifo: florin (ƒ)
    $font = New-Object System.Drawing.Font('Segoe UI', [float]($size * 0.62), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = 'Center'
    $fmt.LineAlignment = 'Center'
    $white = [System.Drawing.Brushes]::White
    $g.DrawString([char]0x0192, $font, $white, (New-Object System.Drawing.RectangleF(0, [float]($size * -0.02), $size, $size)), $fmt)

    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "OK $path"
}

$base = 'C:\Users\Usuario\Documents\PWA FINANZAS\img'
New-Icon 512 "$base\icon-512.png"
New-Icon 192 "$base\icon-192.png"
New-Icon 180 "$base\apple-touch-icon.png"
