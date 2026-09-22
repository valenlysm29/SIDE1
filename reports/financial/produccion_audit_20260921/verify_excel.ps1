param([switch]$ReadOnlyCheck)
$ErrorActionPreference = 'Stop'
$excelCheck = $null
$bookCheck = $null
try {
    $excelCheck = New-Object -ComObject Excel.Application
    $excelCheck.Visible = $false
    $excelCheck.DisplayAlerts = $false
    $excelCheck.AskToUpdateLinks = $false
    $excelCheck.AutomationSecurity = 3
    $bookCheck = $excelCheck.Workbooks.Open((Join-Path $PSScriptRoot 'DECISIONES_SIDE_corregido.xlsx'), 0, [bool]$ReadOnlyCheck)
    $sheetCheck = $bookCheck.Worksheets.Item('CANTIDAD DE PRODUCCIÓN')
    $excelCheck.CalculateFullRebuild()
    $debugCheck = @()
    foreach ($addrCheck in @('K56','K57','K58','T9','T10','T11','E141','F141','G141','H141','I141','J141','E142','H142','E143','H143','E144','H144','H145','M137','M138','M139','J154','N5','E56','E57','E58','G75')) {
        $debugCheck += @{cell=$addrCheck;value=$sheetCheck.Range($addrCheck).Value2;formula=$sheetCheck.Range($addrCheck).Formula}
    }
    $debugCheck | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'native_debug.json') -Encoding utf8
    $expectedCheck = @{ N5=397; E56=191; E57=137; E58=69; Q11=397; J128=1269; J141=1112; J154=225; J132=3500; J145=3500; J158=800 }
    foreach ($keyCheck in $expectedCheck.Keys) {
        $actualCheck = $sheetCheck.Range($keyCheck).Value2
        if ($actualCheck -ne $expectedCheck[$keyCheck]) { throw "$keyCheck expected $($expectedCheck[$keyCheck]), got $actualCheck" }
    }
    foreach ($rowCheck in 63..71) {
        $balanceCheck = $sheetCheck.Range("D$rowCheck").Value2 + $sheetCheck.Range("E$rowCheck").Value2 - $sheetCheck.Range("F$rowCheck").Value2
        if ([Math]::Abs($sheetCheck.Range("G$rowCheck").Value2 - $balanceCheck) -gt 0.000001) { throw "Inventory row $rowCheck does not reconcile" }
    }
    $sheetCheck.Range('D37:D39').Value2 = 0
    $excelCheck.CalculateFullRebuild()
    if ($sheetCheck.Range('Q11').Value2 -ne 0) { throw 'Zero-plan test failed in Excel' }
    $sheetCheck.Range('D37').Value2 = 250
    $sheetCheck.Range('D38').Value2 = 180
    $sheetCheck.Range('D39').Value2 = 90
    $sheetCheck.Range('E67').Value2 = 0
    $excelCheck.CalculateFullRebuild()
    if ($sheetCheck.Range('Q11').Value2 -ne 340) { throw 'Stock shortage test failed in Excel' }
    $sheetCheck.Range('E67').Value2 = 190
    $sheetCheck.Range('T7').Value2 = 2
    $excelCheck.CalculateFullRebuild()
    if ($sheetCheck.Range('J128').Value2 -ge 1269) { throw 'Reputation demand test failed in Excel' }
    $sheetCheck.Range('T7').Value2 = 7
    $excelCheck.CalculateFullRebuild()
    foreach ($keyCheck in $expectedCheck.Keys) {
        if ($sheetCheck.Range($keyCheck).Value2 -ne $expectedCheck[$keyCheck]) { throw "Restore failed: $keyCheck" }
    }
    $errorCellsCheck = @()
    foreach ($worksheetCheck in $bookCheck.Worksheets) {
        try {
            $badRangeCheck = $worksheetCheck.UsedRange.SpecialCells(-4123,16)
            foreach ($badCellCheck in $badRangeCheck.Cells) { $errorCellsCheck += "$($worksheetCheck.Name)!$($badCellCheck.Address()): $($badCellCheck.Text)" }
        } catch [System.Runtime.InteropServices.COMException] { }
    }
    if ($errorCellsCheck | Where-Object { $_ -like 'CANTIDAD DE PRODUCCIÓN!*' }) { throw ($errorCellsCheck -join '; ') }
    if (-not $ReadOnlyCheck) { $bookCheck.ForceFullCalculation = $true; $bookCheck.Save() }
    @{nativeEngine='Microsoft Excel';version=$excelCheck.Version;checks='Capacity, allocation, inventory, zero plan, shortage, reputation, restoration';errors=$errorCellsCheck;status='passed'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'excel_verification.json') -Encoding utf8
    Write-Output 'Native Excel checks passed after full recalculation.'
    if ($errorCellsCheck.Count) { Write-Output ($errorCellsCheck -join [Environment]::NewLine) }
} finally {
    if ($bookCheck) { $bookCheck.Close($false); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($bookCheck) }
    if ($excelCheck) { $excelCheck.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excelCheck) }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
