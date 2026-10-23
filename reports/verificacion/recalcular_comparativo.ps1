$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)
$comparisonExcel = $null
$comparisonBook = $null
try {
    $comparisonExcel = New-Object -ComObject Excel.Application
    $comparisonExcel.Visible = $false
    $comparisonExcel.DisplayAlerts = $false
    $comparisonExcel.AskToUpdateLinks = $false
    $comparisonExcel.AutomationSecurity = 3
    $comparisonBook = $comparisonExcel.Workbooks.Open((Join-Path $PSScriptRoot 'COMPARATIVO_SIDE_vs_EXCEL.xlsx'),0,$false)
    $comparisonExcel.CalculateFullRebuild()
    $comparisonErrors = @()
    $comparisonFormulaCount = 0
    foreach ($comparisonSheet in $comparisonBook.Worksheets) {
        try {
            $comparisonFormulaRange = $comparisonSheet.UsedRange.SpecialCells(-4123)
            $comparisonFormulaCount += $comparisonFormulaRange.Count
        } catch [System.Runtime.InteropServices.COMException] { }
        try {
            $comparisonErrorRange = $comparisonSheet.UsedRange.SpecialCells(-4123,16)
            foreach ($comparisonCell in $comparisonErrorRange.Cells) {
                $comparisonErrors += "$($comparisonSheet.Name)!$($comparisonCell.Address()): $($comparisonCell.Text)"
            }
        } catch [System.Runtime.InteropServices.COMException] { }
    }
    $comparisonSummary = $comparisonBook.Worksheets.Item('Resumen')
    $comparisonResult = @{
        status = $(if ($comparisonErrors.Count -eq 0) { 'success' } else { 'errors_found' })
        motor = 'Microsoft Excel COM'
        version = $comparisonExcel.Version
        total_formulas = $comparisonFormulaCount
        total_errors = $comparisonErrors.Count
        errors = $comparisonErrors
        total = $comparisonSummary.Range('B15').Value2
        ok = $comparisonSummary.Range('C15').Value2
        diferencia = $comparisonSummary.Range('D15').Value2
        pendiente = $comparisonSummary.Range('E15').Value2
        no_comparable = $comparisonSummary.Range('F15').Value2
        tolerancia_absoluta = $comparisonSummary.Range('B4').Value2
    }
    $comparisonBook.Save()
    $comparisonResult | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'recalculo_comparativo.json') -Encoding utf8
    $comparisonResult | ConvertTo-Json -Depth 6
    if ($comparisonErrors.Count -gt 0) { throw 'El comparativo contiene errores de fórmula.' }
} finally {
    if ($comparisonBook) { $comparisonBook.Close($false); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($comparisonBook) }
    if ($comparisonExcel) { $comparisonExcel.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($comparisonExcel) }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
