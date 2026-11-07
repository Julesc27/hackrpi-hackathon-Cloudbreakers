# Deploy what's on GitHub main to https://cloudbreakers.club
# Starts the "Deploy" GitHub Actions pipeline (build checks -> server redeploy) and follows it.
# Needs the GitHub CLI logged in with push access:  gh auth login
#   .\deploy.ps1
$ErrorActionPreference = 'Stop'

$Repo = 'Julesc27/hackrpi-hackathon-Cloudbreakers'
$Workflow = 'deploy.yml'

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Write-Host 'Install the GitHub CLI first: https://cli.github.com'; exit 1 }
gh auth status *> $null
if ($LASTEXITCODE -ne 0) { Write-Host 'Run: gh auth login'; exit 1 }

# Deploys use GitHub's main, not your local files. Warn about work that isn't pushed.
git rev-parse --git-dir *> $null
if ($LASTEXITCODE -eq 0) {
    git fetch -q origin main 2>$null
    $ahead = (git rev-list --count origin/main..HEAD 2>$null)
    if (-not $ahead) { $ahead = 0 }
    $dirty = @(git status --porcelain).Count
    if ([int]$ahead -gt 0 -or $dirty -gt 0) {
        Write-Host "Heads up: you have $ahead unpushed commit(s) and $dirty uncommitted change(s)."
        Write-Host "Only what's on GitHub main gets deployed."
        $ok = Read-Host 'Deploy GitHub main anyway? [y/N]'
        if ($ok -notmatch '^[Yy]$') { exit 1 }
    }
}

$tip = gh api "repos/$Repo/commits/main" --jq '.sha[0:7] + "  " + (.commit.message | split("\n")[0])'
Write-Host "Deploying main @ $tip"

$before = gh run list -R $Repo -w $Workflow -L 1 --json databaseId --jq '.[0].databaseId // 0'
gh workflow run $Workflow -R $Repo --ref main
if ($LASTEXITCODE -ne 0) { exit 1 }

# Wait for the new run to show up, then follow it until it finishes.
$run = $before
for ($i = 0; $i -lt 30 -and ($run -eq $before -or $run -eq '0'); $i++) {
    Start-Sleep -Seconds 2
    $run = gh run list -R $Repo -w $Workflow -L 1 --json databaseId --jq '.[0].databaseId // 0'
}
if ($run -eq $before) { Write-Host "Couldn't find the new run; check the Actions tab."; exit 1 }

Write-Host "Run: https://github.com/$Repo/actions/runs/$run"
gh run watch $run -R $Repo --exit-status --interval 5
if ($LASTEXITCODE -eq 0) {
    Write-Host 'Deployed. https://cloudbreakers.club'
} else {
    Write-Host 'Deploy failed. Logs:'
    gh run view $run -R $Repo --log-failed | Select-Object -Last 40
    exit 1
}
