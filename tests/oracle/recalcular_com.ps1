param([Parameter(Mandatory=$true)][string]$Plan,[Parameter(Mandatory=$true)][string]$Modelo,[Parameter(Mandatory=$true)][string]$LibroSalida,[Parameter(Mandatory=$true)][string]$JsonSalida)
$ErrorActionPreference='Stop'
$raizSIDE=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location -LiteralPath $raizSIDE
$escenarioSIDE=Get-Content -LiteralPath $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
Copy-Item -LiteralPath $Modelo -Destination $LibroSalida -Force
$excelPropio=$null;$libroPropio=$null
try {
    $excelPropio=New-Object -ComObject Excel.Application
    $excelPropio.Visible=$false;$excelPropio.DisplayAlerts=$false;$excelPropio.AskToUpdateLinks=$false
    $libroPropio=$excelPropio.Workbooks.Open($LibroSalida,0,$false)
    foreach($hojaSIDE in $escenarioSIDE.entradas.PSObject.Properties){
        $sheetSIDE=$libroPropio.Worksheets.Item($hojaSIDE.Name)
        foreach($celdaSIDE in $hojaSIDE.Value.PSObject.Properties){
            $valueSIDE=$celdaSIDE.Value
            if($null -eq $valueSIDE){$sheetSIDE.Range($celdaSIDE.Name).ClearContents()}elseif($valueSIDE -is [bool]){$sheetSIDE.Range($celdaSIDE.Name).Value2=[bool]$valueSIDE}elseif($valueSIDE -is [string]){$sheetSIDE.Range($celdaSIDE.Name).Value2=[string]$valueSIDE}else{$sheetSIDE.Range($celdaSIDE.Name).Value2=[double]$valueSIDE}
        }
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($sheetSIDE)
    }
    $excelPropio.CalculateFullRebuild()
    $libroPropio.Save()
    $valoresSIDE=[ordered]@{};$celdasSIDE=[ordered]@{}
    foreach($salidaSIDE in $escenarioSIDE.salidas.PSObject.Properties){
        $addressSIDE=$salidaSIDE.Value
        $valorSIDE=$libroPropio.Worksheets.Item($addressSIDE[0]).Range($addressSIDE[1]).Value2
        $valoresSIDE[$salidaSIDE.Name]=$valorSIDE
        $celdasSIDE[$salidaSIDE.Name]=$addressSIDE
    }
    $resultadoSIDE=[ordered]@{metadatos=[ordered]@{escenario=$escenarioSIDE.nombre;motor='Microsoft Excel COM';version=$excelPropio.Version;estadoCalculo=$excelPropio.CalculationState;nota='Diez hojas originales preservadas; errores heredados de CANTIDAD no se usan como salidas.'};valores=$valoresSIDE;celdas=$celdasSIDE}
    $resultadoSIDE | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $JsonSalida -Encoding UTF8
    Write-Output ('Recalculado '+$escenarioSIDE.nombre+': '+$valoresSIDE.Count+' salidas')
}finally{
    if($null -ne $libroPropio){$libroPropio.Close($false);[void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($libroPropio)}
    if($null -ne $excelPropio){$excelPropio.Quit();[void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($excelPropio)}
}
