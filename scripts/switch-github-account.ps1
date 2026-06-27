param(
  [switch]$Global,
  [string]$RemoteName = "origin",
  [string]$RemoteUrl = "https://polly0701@github.com/polly0701/stickWithit.git",
  [string]$SupabaseProjectRef = "ihtmorgmsfptcmblvpnl",
  [string]$SupabaseAccessToken,
  [string[]]$SupabaseEnvFiles = @(".env.example", ".env"),
  [switch]$SkipGitHubCliAuth,
  [switch]$SkipSupabaseCliAuth,
  [switch]$SkipSupabaseLink,
  [switch]$SkipRemoteCheck,
  [switch]$SkipSupabaseConfigUpdate
)

$ErrorActionPreference = "Stop"

$gitUserName = "polly0701"
$gitUserEmail = "polly@gnu.ac.kr"
$expectedGitHubHost = "github.com"
$expectedRepository = "polly0701/stickWithit"
$scopeArgs = @()
$scopeLabel = "local repository"

function Test-CommandExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CommandName
  )

  return $null -ne (Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Write-Utf8File {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Content
  )

  $resolvedPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
  $encoding = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($resolvedPath, $Content, $encoding)
}

function Set-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return $false
  }

  $lines = Get-Content -LiteralPath $Path
  $keyPattern = "^\s*$([regex]::Escape($Key))="
  $updated = $false

  for ($index = 0; $index -lt $lines.Count; $index++) {
    if ($lines[$index] -match $keyPattern) {
      $lines[$index] = "$Key=$Value"
      $updated = $true
      break
    }
  }

  if (-not $updated) {
    $lines += "$Key=$Value"
  }

  Write-Utf8File -Path $Path -Content (($lines -join [Environment]::NewLine) + [Environment]::NewLine)
  return $true
}

function Set-SupabaseProjectRef {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$ProjectRef
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return $false
  }

  $content = Get-Content -LiteralPath $Path -Raw
  $pattern = "(?m)^export const SUPABASE_PROJECT_REF = '[a-z0-9]+';$"
  $replacement = "export const SUPABASE_PROJECT_REF = '$ProjectRef';"

  if ($content -notmatch $pattern) {
    return $false
  }

  $updatedContent = $content -replace $pattern, $replacement

  if ($updatedContent -eq $content) {
    return $true
  }

  Write-Utf8File -Path $Path -Content $updatedContent
  return $true
}

function Set-SupabaseActiveSession {
  param(
    [string]$AccessToken
  )

  if (-not $AccessToken) {
    Write-Host ""
    Write-Warning "Supabase CLI login skipped because no access token was provided."
    Write-Host "  Set SUPABASE_ACCESS_TOKEN_POLLY or pass -SupabaseAccessToken <token>."
    return
  }

  if (-not (Test-CommandExists -CommandName "npx")) {
    Write-Host ""
    Write-Warning "Supabase CLI login skipped because npx is not installed."
    return
  }

  Write-Host ""
  Write-Host "Logging in to Supabase CLI..."
  npx supabase login --token $AccessToken

  if ($LASTEXITCODE -ne 0) {
    throw "Failed to log in to Supabase CLI."
  }

  Write-Host "Supabase CLI login completed."
}

function Get-SupabaseAccessToken {
  param(
    [string]$ProvidedAccessToken,
    [string]$EnvironmentVariableName = "SUPABASE_ACCESS_TOKEN_POLLY"
  )

  if ($ProvidedAccessToken) {
    return $ProvidedAccessToken
  }

  $processToken = [Environment]::GetEnvironmentVariable($EnvironmentVariableName, "Process")

  if ($processToken) {
    return $processToken
  }

  $userToken = [Environment]::GetEnvironmentVariable($EnvironmentVariableName, "User")

  if ($userToken) {
    [Environment]::SetEnvironmentVariable($EnvironmentVariableName, $userToken, "Process")
    return $userToken
  }

  return $null
}

function Set-SupabaseLinkedProject {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRef
  )

  if (-not (Test-CommandExists -CommandName "npx")) {
    Write-Host ""
    Write-Warning "Supabase project link skipped because npx is not installed."
    return
  }

  Write-Host ""
  Write-Host "Linking Supabase project:"
  Write-Host "  project ref = $ProjectRef"

  npx supabase link --project-ref $ProjectRef

  if ($LASTEXITCODE -ne 0) {
    throw "Failed to link Supabase project '$ProjectRef'. Check that the active Supabase account has access and the project is not paused."
  }

  Write-Host "Supabase project link completed."
}

if ($Global) {
  $scopeArgs = @("--global")
  $scopeLabel = "global"
}

git config @scopeArgs user.name $gitUserName
git config @scopeArgs user.email $gitUserEmail

$currentName = git config @scopeArgs --get user.name
$currentEmail = git config @scopeArgs --get user.email

Write-Host "Git identity updated for ${scopeLabel}:"
Write-Host "  user.name  = $currentName"
Write-Host "  user.email = $currentEmail"

if ($Global) {
  Write-Host ""
  Write-Host "Skipped remote and authentication updates because -Global only changes global Git identity."
  exit 0
}

if (-not $SkipSupabaseConfigUpdate) {
  if ($SupabaseProjectRef -notmatch '^[a-z0-9]+$') {
    throw "Supabase project ref must contain only lowercase letters and numbers: $SupabaseProjectRef"
  }

  $supabaseUrl = "https://$SupabaseProjectRef.supabase.co"
  $updatedEnvFiles = @()

  foreach ($envFile in $SupabaseEnvFiles) {
    if (Set-EnvValue -Path $envFile -Key "VITE_SUPABASE_URL" -Value $supabaseUrl) {
      $updatedEnvFiles += $envFile
    }
  }

  $supabaseSourceUpdated = Set-SupabaseProjectRef `
    -Path ".\src\lib\supabaseClient.ts" `
    -ProjectRef $SupabaseProjectRef

  Write-Host ""
  Write-Host "Supabase configuration updated:"
  Write-Host "  project ref = $SupabaseProjectRef"
  Write-Host "  url         = $supabaseUrl"

  if ($updatedEnvFiles.Count -gt 0) {
    Write-Host "  env files   = $($updatedEnvFiles -join ', ')"
  } else {
    Write-Warning "No Supabase env files were found to update."
  }

  if ($supabaseSourceUpdated) {
    Write-Host "  source ref  = .\src\lib\supabaseClient.ts"
  } else {
    Write-Warning "Could not update SUPABASE_PROJECT_REF in .\src\lib\supabaseClient.ts."
  }
}

if (-not $SkipSupabaseCliAuth) {
  $SupabaseAccessToken = Get-SupabaseAccessToken -ProvidedAccessToken $SupabaseAccessToken
  Set-SupabaseActiveSession -AccessToken $SupabaseAccessToken
}

if (-not $SkipSupabaseLink) {
  Set-SupabaseLinkedProject -ProjectRef $SupabaseProjectRef
}

git config --local "credential.https://github.com.useHttpPath" true

Write-Host ""
Write-Host "GitHub credential matching updated:"
Write-Host "  credential.https://github.com.useHttpPath = true"

if (-not $SkipGitHubCliAuth) {
  $ghCommand = Get-Command gh -ErrorAction SilentlyContinue

  if ($ghCommand) {
    Write-Host ""
    Write-Host "Switching GitHub CLI active account to $gitUserName..."
    gh auth switch --hostname $expectedGitHubHost --user $gitUserName

    Write-Host "Configuring Git to use GitHub CLI authentication..."
    gh auth setup-git --hostname $expectedGitHubHost
  } else {
    Write-Host ""
    Write-Warning "GitHub CLI was not found. Skipped GitHub CLI authentication setup."
  }
}

$existingRemoteUrl = git remote get-url $RemoteName 2>$null

if (-not $existingRemoteUrl) {
  git remote add $RemoteName $RemoteUrl
  $existingRemoteUrl = $RemoteUrl
  Write-Host ""
  Write-Host "Git remote added:"
  Write-Host "  $RemoteName = $existingRemoteUrl"
} elseif ($existingRemoteUrl -ne $RemoteUrl) {
  git remote set-url $RemoteName $RemoteUrl
  $existingRemoteUrl = $RemoteUrl
  Write-Host ""
  Write-Host "Git remote updated:"
  Write-Host "  $RemoteName = $existingRemoteUrl"
} else {
  Write-Host ""
  Write-Host "Git remote already configured:"
  Write-Host "  $RemoteName = $existingRemoteUrl"
}

if ($SkipRemoteCheck) {
  Write-Host ""
  Write-Host "Remote access check skipped."
  exit 0
}

Write-Host ""
Write-Host "Checking GitHub remote access..."

$remoteCheckOutput = & git ls-remote --exit-code $RemoteName HEAD 2>&1
$remoteCheckExitCode = $LASTEXITCODE

if ($remoteCheckExitCode -eq 0) {
  Write-Host "Remote access check passed."
  exit 0
}

$remoteCheckText = ($remoteCheckOutput | Out-String).Trim()

Write-Host ""
Write-Warning "Remote access check failed."

if ($remoteCheckText) {
  Write-Host $remoteCheckText
}

Write-Host ""
Write-Host "If 'Repository not found' appears during git pull, check these items:"
Write-Host "  1. The repository exists: https://$expectedGitHubHost/$expectedRepository"
Write-Host "  2. The signed-in GitHub account has access to that repository."
Write-Host "  3. Git Credential Manager or GitHub CLI may still be using another GitHub account."
Write-Host ""
Write-Host "To refresh cached GitHub HTTPS credentials on Windows, then rerun this script:"
Write-Host "  git credential-manager github logout"
Write-Host "  gh auth login --hostname $expectedGitHubHost --web"
Write-Host "  .\scripts\switch-github-account.ps1"
Write-Host ""
Write-Host "You can also set a different remote URL:"
Write-Host "  .\scripts\switch-github-account.ps1 -RemoteUrl https://<account>@github.com/<owner>/<repo>.git"

exit $remoteCheckExitCode
