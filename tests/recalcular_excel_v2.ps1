param([Parameter(Mandatory=$true)][string]$WorkbookPath)
$ErrorActionPreference = 'Stop'
$workbookSide = $null
$excelSide = $null
try {
  $excelSide = New-Object -ComObject Excel.Application
  $excelSide.Visible = $false
  $excelSide.DisplayAlerts = $false
  $excelSide.AutomationSecurity = 3
  $workbookSide = $excelSide.Workbooks.Open((Resolve-Path -LiteralPath $WorkbookPath).Path, 0, $true)
  $excelSide.CalculateFullRebuild()
  $sheetSide = $workbookSide.Worksheets.Item('Costos De Producción')
  foreach ($addressSide in @('K5','L5','M5','N5','D46','D47','D48','E46','E47','E48','E49','H49','I49','J49','L49','M49','N49','F54','F55','F56','F57','F58','F59','F60','F61','G54','G55','G56','G57','G58','G59','G60','G61')) {
    $cellSide = $sheetSide.Range($addressSide)
    [PSCustomObject]@{cell=$addressSide;formula=$cellSide.Formula;value=$cellSide.Value2}
  }
} finally {
  if ($workbookSide) { $workbookSide.Close($false); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($workbookSide) }
  if ($excelSide) { $excelSide.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excelSide) }
}
