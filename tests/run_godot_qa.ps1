param(
    [string]$GodotExe = '',
    [string]$RunName = ('godot-qa-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'godot4/project.godot'))) {
    throw 'El ejecutor debe estar dentro de SIDE1/tests.'
}
if ($RunName -notmatch '^[a-zA-Z0-9_-]+$') {
    throw 'RunName sólo admite letras, números, guion y guion bajo.'
}
if (-not $GodotExe) {
    $GodotExe = Join-Path $projectRoot '.codex-work/godot/Godot_v4.7.2-stable_win64_console.exe'
}
if (-not (Test-Path -LiteralPath $GodotExe)) {
    throw 'Indica la ruta de tu ejecutable Godot con -GodotExe.'
}
$resultsDir = Join-Path $projectRoot 'tests/output'
New-Item -ItemType Directory -Force -Path $resultsDir | Out-Null

# Un exit 0 no basta: los asserts pueden abortar el método sin cerrar Godot.
function Confirm-GodotLog([string]$LogPath, [string]$SuccessMarker = '') {
    if ($LASTEXITCODE -ne 0) { throw "Godot terminó con error; consultar $LogPath" }
    $logText = Get-Content -LiteralPath $LogPath -Raw
    if ($logText -match 'SCRIPT ERROR|(^|\r?\n)ERROR:|WARNING:|Assertion failed') {
        throw "Error o advertencia de Godot; consultar $LogPath"
    }
    if ($SuccessMarker -and $logText -notmatch $SuccessMarker) {
        throw "Falta resultado aprobado $SuccessMarker; consultar $LogPath"
    }
}

$importLog = Join-Path $resultsDir "$RunName-import.log"
& $GodotExe --headless --path godot4 --editor --quit --log-file $importLog
Confirm-GodotLog $importLog
$cases = [ordered]@{
    ground_continuity = 'GROUND_QA_OK'
    map_navigation = 'NAVIGATION_OK'
    world_population = 'WORLD_POPULATION_OK'
    npc_physics = 'NPC_PHYSICS_OK'
    world_flow = 'WORLD_FLOW_OK'
    smoke = 'SMOKE OK'
    npc_flow_smoke = 'NPC_FLOW_OK'
    world_solids = 'WORLD_SOLIDS_OK'
    render_continuity = 'RENDER_CONTINUITY_OK'
    player_physics = 'PLAYER_PHYSICS_OK'
    npc_contacts = 'NPC_CONTACTS_OK'
    npc_spawning = 'NPC_SPAWNING_OK'
    npc_shop_traffic = 'NPC_SHOP_TRAFFIC_OK'
}
$summary = @()
foreach ($testName in $cases.Keys) {
    $logPath = Join-Path $resultsDir "$RunName-$testName.log"
    & $GodotExe --headless --fixed-fps 60 --path godot4 --quit-after 9000 --script "res://tests/$testName.gd" --log-file $logPath
    Confirm-GodotLog $logPath $cases[$testName]
    $summary += [pscustomobject]@{ test = $testName; result = 'PASS'; log = $logPath }
}
$summaryPath = Join-Path $resultsDir "$RunName-summary.json"
$summary | ConvertTo-Json | Set-Content -LiteralPath $summaryPath -Encoding utf8
Write-Output "GODOT_QA_OK: $($summary.Count) pruebas. $summaryPath"
