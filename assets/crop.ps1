Add-Type -AssemblyName System.Drawing
# Recorta o grid 5x2 (1024x572) de sheet.jpg em av1..av10.png centralizados no personagem + pedestal
$src=[System.Drawing.Bitmap]::FromFile((Join-Path $PSScriptRoot 'sheet.jpg'))
$sx=$src.Width/1024.0; $sy=$src.Height/572.0
$cx=@(104,308,513,718,923)
$rows=@(@{y=26},@{y=304})
$w=186; $h=212
$n=1
foreach($r in $rows){ foreach($c in $cx){
  $rw=[int]($w*$sx); $rh=[int]($h*$sy)
  $bmp=New-Object System.Drawing.Bitmap $rw,$rh
  $g=[System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode='HighQualityBicubic'
  $g.DrawImage($src,(New-Object System.Drawing.Rectangle 0,0,$rw,$rh),(New-Object System.Drawing.Rectangle ([int](($c-$w/2)*$sx)),([int]($r.y*$sy)),$rw,$rh),[System.Drawing.GraphicsUnit]::Pixel)
  $bmp.Save((Join-Path $PSScriptRoot "av$n.png"),[System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose();$bmp.Dispose();$n++
}}
$src.Dispose()
