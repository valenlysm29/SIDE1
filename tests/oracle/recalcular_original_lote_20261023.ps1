param([Parameter(Mandatory=$true)][string]$Manifest,[Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference='Stop'
$raizSIDE=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location -LiteralPath $raizSIDE
$planesSIDE=Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
$sourceSIDE=Join-Path $raizSIDE $planesSIDE.source
$destinationSIDE=[IO.Path]::GetFullPath($Destination)
if(-not $destinationSIDE.StartsWith((Join-Path $raizSIDE 'tests\output\'),[StringComparison]::OrdinalIgnoreCase)){throw 'La salida debe permanecer en SIDE1/tests/output.'}
[void][IO.Directory]::CreateDirectory($destinationSIDE)
$excelSIDE=$null
$bookSIDE=$null
$metadataSIDE=@()
try {
    $excelSIDE=New-Object -ComObject Excel.Application
    $excelSIDE.Visible=$false
    $excelSIDE.DisplayAlerts=$false
    $excelSIDE.AskToUpdateLinks=$false
    foreach($planSIDE in $planesSIDE.planes){
        if($planSIDE.nombre -notmatch '^[a-z0-9_]+$'){throw 'Nombre de caso inválido'}
        $copySIDE=Join-Path $destinationSIDE ($planSIDE.nombre+'.xlsx')
        Copy-Item -LiteralPath $sourceSIDE -Destination $copySIDE -Force
        $bookSIDE=$excelSIDE.Workbooks.Open($copySIDE,0,$false)
        foreach($sheetInputsSIDE in $planSIDE.entradas.PSObject.Properties){
            $sheetSIDE=$bookSIDE.Worksheets.Item($sheetInputsSIDE.Name)
            try {
                foreach($cellSIDE in $sheetInputsSIDE.Value.PSObject.Properties){
                    $valueSIDE=$cellSIDE.Value
                    if($null -eq $valueSIDE){$sheetSIDE.Range($cellSIDE.Name).ClearContents()}
                    elseif($valueSIDE -is [bool]){$sheetSIDE.Range($cellSIDE.Name).Value2=[bool]$valueSIDE}
                    elseif($valueSIDE -is [string]){$sheetSIDE.Range($cellSIDE.Name).Value2=[string]$valueSIDE}
                    else{$sheetSIDE.Range($cellSIDE.Name).Value2=[double]$valueSIDE}
                }
            } finally {[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($sheetSIDE)}
        }
        $excelSIDE.CalculateFullRebuild()
        if($excelSIDE.CalculationState -ne 0){throw 'Excel no terminó el cálculo'}
        $bookSIDE.Save()
        $metadataSIDE+=@{nombre=$planSIDE.nombre;engine='Microsoft Excel COM';version=$excelSIDE.Version;calculation_state=[int]$excelSIDE.CalculationState}
        $bookSIDE.Close($false)
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($bookSIDE)
        $bookSIDE=$null
        Write-Output ('Recalculado original: '+$planSIDE.nombre)
    }
    $metadataSIDE | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destinationSIDE 'metadata.json') -Encoding UTF8
} finally {
    if($null -ne $bookSIDE){$bookSIDE.Close($false);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($bookSIDE)}
    if($null -ne $excelSIDE){$excelSIDE.Quit();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excelSIDE)}
}
