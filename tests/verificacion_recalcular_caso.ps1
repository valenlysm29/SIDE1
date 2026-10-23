param([string]$Caso='E13')
$ErrorActionPreference='Stop'
$rootSide=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $rootSide
$datosSide=Get-Content 'reports/verificacion/datos_excel.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$casoSide=$datosSide.escenarios | Where-Object id -eq $Caso
if(-not $casoSide){throw 'Caso desconocido'}
$salidaSide=Join-Path $rootSide ('tests/output/verificacion/'+$Caso+'.xlsx')
Copy-Item -LiteralPath (Join-Path $rootSide $datosSide.fuente) -Destination $salidaSide -Force
$excelSide=$null;$libroSide=$null
try {
 $excelSide=New-Object -ComObject Excel.Application
 $excelSide.Visible=$false;$excelSide.DisplayAlerts=$false;$excelSide.AskToUpdateLinks=$false
 $libroSide=$excelSide.Workbooks.Open($salidaSide,0,$false)
 foreach($hojaSide in $casoSide.entradas_excel.PSObject.Properties){
  $sheetSide=$libroSide.Worksheets.Item($hojaSide.Name)
  foreach($celdaSide in $hojaSide.Value.PSObject.Properties){
   if($null -eq $celdaSide.Value){$sheetSide.Range($celdaSide.Name).ClearContents()}
   elseif($celdaSide.Value -is [string]){$sheetSide.Range($celdaSide.Name).Value2=[string]$celdaSide.Value}
   else{$sheetSide.Range($celdaSide.Name).Value2=[double]$celdaSide.Value}
  }
  [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($sheetSide)
 }
 $excelSide.CalculateFullRebuild()
 if($excelSide.CalculationState -ne 0){throw 'Calculo sin terminar'}
 $libroSide.Save()
 Write-Output "Recalculado $Caso en copia del original; estado de calculo 0"
} finally {
 if($libroSide){$libroSide.Close($false);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($libroSide)}
 if($excelSide){$excelSide.Quit();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excelSide)}
}
