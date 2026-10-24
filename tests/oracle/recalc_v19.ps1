param([string]$Book='docs/DECISIONES_SIDE_19.xlsx')
$ErrorActionPreference='Stop'
$sideRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location -LiteralPath $sideRoot
$sidePath=[System.IO.Path]::GetFullPath((Join-Path $sideRoot $Book))
if(-not $sidePath.StartsWith($sideRoot+[System.IO.Path]::DirectorySeparatorChar)){throw 'Book must stay inside SIDE1'}
$sideExcel=$null;$sideBook=$null
try {
 $sideExcel=New-Object -ComObject Excel.Application
 $sideExcel.Visible=$false;$sideExcel.DisplayAlerts=$false;$sideExcel.AskToUpdateLinks=$false
 $sideBook=$sideExcel.Workbooks.Open($sidePath,0,$false)
 $sideExcel.CalculateFullRebuild()
 $sideBook.Save()
 Write-Output ('Recalculated with Microsoft Excel COM '+$sideExcel.Version+'; CalculationState='+$sideExcel.CalculationState)
}finally{
 if($null -ne $sideBook){$sideBook.Close($false);[void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($sideBook)}
 if($null -ne $sideExcel){$sideExcel.Quit();[void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($sideExcel)}
}
