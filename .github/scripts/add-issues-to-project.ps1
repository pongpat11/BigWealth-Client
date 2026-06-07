# Adds open [FE] issues from BigWealth-Client to user project 3.
# Prereq: gh auth refresh -s read:project,project

$ErrorActionPreference = "Stop"
$Owner = "pongpat11"
$Repo = "BigWealth-Client"
$ProjectNumber = 3

$issues = gh issue list --repo "$Owner/$Repo" --label frontend --state open --json url -q ".[].url"
foreach ($url in $issues) {
    gh project item-add $ProjectNumber --owner $Owner --url $url
    Write-Host "Added: $url"
}
Write-Host "Done. $($issues.Count) items on project $ProjectNumber."
