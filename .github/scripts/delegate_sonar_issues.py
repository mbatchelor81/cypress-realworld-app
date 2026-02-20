#!/usr/bin/env python3
"""
Query SonarQube for open issues and create one Devin session per issue.
Each session gets a prompt to fix the issue, run tests, and open a PR.
"""

import json
import os
import asyncio
import aiohttp

DEVIN_SERVICE_USER_TOKEN = os.environ["DEVIN_SERVICE_USER_TOKEN"]
DEVIN_ORG_ID = os.environ["DEVIN_ORG_ID"]
SONAR_TOKEN = os.environ["SONAR_TOKEN"]
SONAR_HOST_URL = os.environ["SONAR_HOST_URL"].rstrip("/")
SONAR_PROJECT_KEY = os.environ.get("SONAR_PROJECT_KEY", "mbatchelor81_cypress-realworld-app")

DEVIN_API_URL = f"https://api.devin.ai/v3beta1/organizations/{DEVIN_ORG_ID}/sessions"
SONAR_ISSUES_URL = f"{SONAR_HOST_URL}/api/issues/search"

CREATE_AS_USER_ID = "email|68c322be31ab500694e66453"
REPO = "mbatchelor81/cypress-realworld-app"

MAX_CONCURRENT_SESSIONS = 20

DEVIN_HEADERS = {
    "Authorization": f"Bearer {DEVIN_SERVICE_USER_TOKEN}",
    "Content-Type": "application/json",
}


def fetch_sonar_issues():
    """Fetch all open issues from SonarQube API with pagination."""
    import urllib.request
    import base64

    credentials = base64.b64encode(f"{SONAR_TOKEN}:".encode()).decode()
    all_issues = []
    page = 1
    page_size = 100

    while True:
        params = (
            f"?componentKeys={SONAR_PROJECT_KEY}"
            f"&statuses=OPEN,CONFIRMED,REOPENED"
            f"&types=VULNERABILITY"
            f"&severities=CRITICAL,BLOCKER"
            f"&ps={page_size}"
            f"&p={page}"
        )
        req = urllib.request.Request(
            SONAR_ISSUES_URL + params,
            headers={"Authorization": f"Basic {credentials}"},
        )
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")
            raise SystemExit(
                f"SonarQube API error (HTTP {e.code}): {body}"
            )

        issues = data.get("issues", [])
        all_issues.extend(issues)

        total = data.get("total", 0)
        if len(all_issues) >= total or not issues:
            break
        page += 1

    return {"issues": all_issues, "total": len(all_issues)}


async def create_devin_session(session, semaphore, issue):
    """Create a Devin session for a single SonarQube issue."""
    rule = issue.get("rule", "unknown")
    severity = issue.get("severity", "MAJOR")
    message = issue.get("message", "No description")
    component = issue.get("component", "").replace(f"{SONAR_PROJECT_KEY}:", "")
    line = issue.get("line", "unknown")
    issue_type = issue.get("type", "CODE_SMELL")
    issue_key = issue.get("key", "unknown")

    prompt = (
        f"SonarQube Issue Remediation\n\n"
        f"Issue Key: {issue_key}\n"
        f"Rule: {rule}\n"
        f"Type: {issue_type}\n"
        f"Severity: {severity}\n"
        f"File: {component}\n"
        f"Line: {line}\n"
        f"Message: {message}\n\n"
        f"Instructions:\n"
        f"1. Open `{component}` and fix the issue described above at/near line {line}\n"
        f"2. Follow the SonarQube rule guidance for {rule}\n"
        f"3. Run `npm test` and `npm run lint` to verify nothing breaks\n"
        f"4. If tests fail, fix any regressions caused by the change\n"
        f"5. Create a PR with the title: 'fix({issue_type.lower()}): resolve {severity.lower()} SonarQube issue in {component}'\n"
    )

    title = f"sonar-{issue_key}: {severity.lower()} {issue_type.lower()} in {component}"
    data = {
        "prompt": prompt,
        "create_as_user_id": CREATE_AS_USER_ID,
        "repos": [REPO],
        "title": title,
        "tags": ["sonarqube", issue_key],
    }

    async with semaphore:
        async with session.post(DEVIN_API_URL, headers=DEVIN_HEADERS, json=data) as resp:
            result = await resp.json()
            status = "created" if resp.status in (200, 201) else "failed"
            print(f"[{status}] {component}:{line} ({severity} {issue_type}): {result.get('session_id', 'N/A')}")
            return result


async def main():
    print(f"Querying SonarQube at {SONAR_HOST_URL} for project {SONAR_PROJECT_KEY}...")
    data = fetch_sonar_issues()
    issues = data.get("issues", [])

    if not issues:
        print("No issues found. Exiting.")
        return

    print(f"Found {len(issues)} issues. Creating Devin sessions...")

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_SESSIONS)
    async with aiohttp.ClientSession() as session:
        tasks = [create_devin_session(session, semaphore, issue) for issue in issues]
        await asyncio.gather(*tasks)

    print("All sessions created.")


if __name__ == "__main__":
    asyncio.run(main())
