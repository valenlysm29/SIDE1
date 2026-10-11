$ErrorActionPreference = 'Stop'
$raizSIDE = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location -LiteralPath $raizSIDE
$fuenteSIDE = Join-Path $raizSIDE '.codex-work/DECISIONES_SIDE_16.xlsx'
$recalculadoSIDE = Join-Path $raizSIDE '.codex-work/DECISIONES_SIDE_16_recalculado.xlsx'
Copy-Item -LiteralPath $fuenteSIDE -Destination $recalculadoSIDE -Force
$excelPropio = $null
$libroPropio = $null
try {
    $excelPropio = New-Object -ComObject Excel.Application
    $excelPropio.Visible = $false
    $excelPropio.DisplayAlerts = $false
    $excelPropio.AskToUpdateLinks = $false
    $libroPropio = $excelPropio.Workbooks.Open($recalculadoSIDE, 0, $false)
    $excelPropio.CalculateFullRebuild()
    $libroPropio.Save()
    $metadatosSIDE = [ordered]@{motor='Microsoft Excel COM';version=$excelPropio.Version;archivo='.codex-work/DECISIONES_SIDE_16_recalculado.xlsx';calculationState=$excelPropio.CalculationState}
    $metadatosSIDE | ConvertTo-Json | Set-Content -LiteralPath 'docs/logica_excel/recalculo_fuente.json' -Encoding UTF8
    $metadatosSIDE | ConvertTo-Json
} finally {
    if ($null -ne $libroPropio) { $libroPropio.Close($false); [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($libroPropio) }
    if ($null -ne $excelPropio) { $excelPropio.Quit(); [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($excelPropio) }
}
