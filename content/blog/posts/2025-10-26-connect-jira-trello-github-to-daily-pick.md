---
title: "How to Connect Jira, Trello, and GitHub to Daily Pick: Complete Integration Guide"
date: 2025-10-26
description: "Step-by-step setup guide for integrating Jira Cloud API tokens, Trello API keys, and GitHub Personal Access Tokens into Daily Pick for automated stand-up queues."
layout: post.njk
tags: ["jira", "trello", "github", "daily pick", "standup automation", "team productivity", "integrations"]
canonical: "https://dailypick.dev/blog/connect-jira-trello-github-to-daily-pick/"
author: Daily Pick
updated: 2026-04-10
section: Integrations
keywords: connect jira to standup, connect trello to standup, connect github to standup, daily pick integrations, standup board sync
ogImage: /assets/og-image-main.png
ogImageAlt: Connecting Jira, Trello, and GitHub to Daily Pick standup queues
twitterImage: /assets/og-image-main.png
twitterImageAlt: Connecting Jira, Trello, and GitHub to Daily Pick standup queues
robots: index,follow
---

Every agile facilitator knows the friction of morning stand-ups: opening three different browser tabs, hunting down who is assigned to which in-flight ticket, and manually copying teammate names into a picker wheel or spreadsheet.

Connecting your project tracking systems—**Jira Cloud**, **Trello**, or **GitHub**—directly into Daily Pick eliminates that repetitive busywork. When linked, Daily Pick automatically synchronizes active assignees into your team roster and surfaces in-flight tasks alongside your favorite selection rituals ([Decision Wheel](/apps/wheel/), [Speedway Racer](/apps/speedway/), or [Random List Shuffler](/apps/random-list-shuffler/)).

This comprehensive guide walks through obtaining credentials, configuring read-only connections, testing data syncs, and managing token security across all three platforms.

---

**Table of Contents**
- [Why Connect Your Issue Tracker to Daily Pick?](#why-connect-your-issue-tracker-to-daily-pick)
- [How Daily Pick Handles Credentials (Security & Architecture)](#how-daily-pick-handles-credentials-security--architecture)
- [Part 1: Connecting Jira Cloud (API Token Walkthrough)](#part-1-connecting-jira-cloud-api-token-walkthrough)
- [Part 2: Connecting Trello (API Key + Token Walkthrough)](#part-2-connecting-trello-api-key--token-walkthrough)
- [Part 3: Connecting GitHub (Personal Access Token Walkthrough)](#part-3-connecting-github-personal-access-token-walkthrough)
- [Unified Troubleshooting Matrix](#unified-troubleshooting-matrix)
- [Token Hygiene & Maintenance Best Practices](#token-hygiene--maintenance-best-practices)
- [Frequently Asked Questions](#frequently-asked-questions)

---

## Why Connect Your Issue Tracker to Daily Pick?

When your issue tracker communicates with your meeting picker, your team ceremonies get an immediate efficiency upgrade:

1. **Zero Roster Maintenance:** Teammates who join or leave the sprint board are automatically reflected in your meeting queues without manual roster editing.
2. **Context-Rich Stand-ups:** As each person is selected to speak, Daily Pick can display a snapshot of their currently assigned items, cutting down on "Wait, what ticket was I working on?" delays.
3. **Transparent Sprint Reviews & Retros:** Pull accurate assignment distributions into sprint ceremonies without sharing raw database credentials or complex administrative access.

---

## How Daily Pick Handles Credentials (Security & Architecture)

Security and data privacy are top priorities:

- **Read-Only Scope:** Daily Pick strictly requests read-only permissions for user rosters, board cards, and open issues. Daily Pick will **never** create, modify, delete, or comment on your issues or repositories.
- **Server-Side Token Security:** Integration credentials and API tokens are processed through encrypted HTTPS requests and maintained server-side via Cloudflare Workers rather than being exposed in unencrypted client-side `localStorage`.
- **Zero Third-Party Data Reselling:** Your team names, project keys, and ticket summaries remain exclusively yours. Daily Pick operates ad-free with zero tracking cookies.

---

## Part 1: Connecting Jira Cloud (API Token Walkthrough)

### Requirements Before You Begin
- An active Atlassian Cloud account with read access to the project board.
- The base Jira URL (e.g., `https://yourteam.atlassian.net`).
- The project key associated with your board issues (e.g., `DP` for issues like `DP-142`).

### Step 1: Generate an Atlassian API Token
1. Sign into your Atlassian account and navigate to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).
2. Click **Create API token**.
3. Label the token clearly (e.g., `Daily Pick Standup Sync`) so you can identify it later during security audits.
4. Click **Create** and copy the generated token string immediately. Atlassian will not display this value a second time.

### Step 2: Configure Jira in Daily Pick
1. In Daily Pick, navigate to **Settings → Third-Party Integrations** and select **Jira**.
2. Complete the configuration fields:
   - **Jira Site URL:** Your organization's cloud domain (e.g., `https://yourteam.atlassian.net`).
   - **Project Key:** The uppercase project prefix (e.g., `CORE` or `FRONT`).
   - **Account Email:** The email address linked to the Atlassian user who generated the token.
   - **API Token:** Paste the API token copied in Step 1.
3. Choose your sync toggles:
   - **Enable connection:** Keeps background sync active for scheduled stand-up rosters.
   - **Include assigned work:** Fetches in-flight Jira issues assigned to each team member so they display in the facilitator panel.

### Step 3: Test and Save
1. Click **Test Connection**. Daily Pick validates the credentials against the Atlassian REST API.
2. Verify the preview card displays the expected active assignees under **Players detected**.
3. Click **Save Connection** to finalize setup.

---

## Part 2: Connecting Trello (API Key + Token Walkthrough)

### Requirements Before You Begin
- Access to the Trello workspace and board containing your sprint or kanban cards.
- The URL of the board or specific list you want to sync (e.g., `https://trello.com/b/abcdef12/team-sprint`).

### Step 1: Obtain Your Trello Developer API Key
1. Sign in to Trello and visit [trello.com/app-key](https://trello.com/app-key).
2. Copy the 32-character alphanumeric **Personal Key**.

### Step 2: Generate a Read-Only Access Token
1. On the same `trello.com/app-key` page, locate the **Token** subsection just below your developer key.
2. Click the authorization link to generate an access token.
3. Review Trello's permission screen confirming read access and click **Allow**.
4. Copy the long token string displayed on the confirmation page.

### Step 3: Configure Trello in Daily Pick
1. In Daily Pick, navigate to **Settings → Third-Party Integrations** and select **Trello**.
2. Enter your credentials:
   - **Board or List URL:** Paste the direct link to the target board or list.
   - **API Key:** The 32-character key from Step 1.
   - **API Token:** The authorization token from Step 2.
3. Enable **Include assigned work** if you want Daily Pick to pull card snapshots (capped at 15 cards to keep meetings clean and focused).
4. Click **Test Connection**, confirm members match your roster, and click **Save Connection**.

---

## Part 3: Connecting GitHub (Personal Access Token Walkthrough)

### Requirements Before You Begin
- Read permissions for the target repository (public or private organization repository).
- The repository identifier in `owner/repository` format (e.g., `daily-pick/web-client`).

### Step 1: Create a Personal Access Token (PAT)
1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) while logged into GitHub.
2. Select your preferred token format:
   - **Fine-grained Personal Access Token (Recommended):** Set repository access to "Only select repositories", pick your repo, and set permissions for **Repository permissions → Issues** to **Read-only** and **Metadata** to **Read-only**.
   - **Classic Personal Access Token:** Select `repo` (or `public_repo` for open-source repositories) and `read:org` if syncing organization member rosters.
3. Set an expiration date (we recommend 90 days for balanced security and operational ease).
4. Click **Generate token** and copy the resulting string immediately.

### Step 2: Configure GitHub in Daily Pick
1. Open **Settings → Third-Party Integrations** in Daily Pick and select **GitHub**.
2. Provide:
   - **Repository Full Name:** Enter `owner/repo` exactly as shown in GitHub's URL bar.
   - **Personal Access Token:** Paste the newly generated token.
3. Set **Include assigned work when testing** to pull open pull requests and issues assigned to each collaborator.
4. Click **Test Connection**. Review the detected collaborators, then click **Save Connection**.

---

## Unified Troubleshooting Matrix

When an integration test encounters an error, use this matrix to resolve it quickly:

| Error / Symptom | Likely Cause | Resolution |
| :--- | :--- | :--- |
| **Jira: 401 Unauthorized** | Email mismatch or expired token | Ensure the account email matches the exact Atlassian ID that generated the API token. Regenerate the token if older than your organization's security policy. |
| **Jira: Project Key Not Found** | Key misspelling or missing board permissions | Confirm the uppercase prefix (e.g., `PROJ` instead of `project`). Verify the user has browse permissions in Jira project settings. |
| **Trello: Invalid Key / Token** | Incomplete character copy | Ensure all 32 characters of the API key and the full token string were copied without leading/trailing whitespace. |
| **Trello: Empty Member Roster** | Guests vs. full board members | Ensure teammates are added as official board members rather than external guest observers on specific cards. |
| **GitHub: 404 Not Found** | Repository slug typo or private repo scope | Verify `owner/repo` spelling. If using fine-grained tokens, confirm the target repository was explicitly selected under Repository access. |
| **GitHub: Bad Credentials** | Expired PAT | Check GitHub token settings to confirm the PAT has not expired, then regenerate and update Daily Pick. |

---

## Token Hygiene & Maintenance Best Practices

1. **Use Dedicated Bot or Service Accounts:** For team-level rituals, configure integrations using an engineering service account (e.g., `agile-bot@company.com`) rather than an individual developer's personal credentials. This prevents broken stand-up syncs when team members transition or take PTO.
2. **Establish a 90-Day Rotation Schedule:** Set calendar reminders to rotate API tokens quarterly. Generating a new token and pasting it into Daily Pick takes less than two minutes.
3. **Audit Token Scopes Regularly:** Never grant write or administrator permissions to display or meeting tools. Restrict scopes strictly to Read-Only metadata and issue tracking.

---

## Frequently Asked Questions

### Do these integrations require organization administrator permissions?
No. Daily Pick requires only standard read access to issues and boards that your user account can already view. You do not need Jira Site Admin, Trello Enterprise Admin, or GitHub Organization Owner permissions to connect your team boards.

### Does Daily Pick modify or write to our Jira tickets, Trello cards, or GitHub issues?
No. Daily Pick's API clients use strictly read-only GET endpoints. It will never add comments, update statuses, assign issues, or alter your source-of-truth project management boards.

### Can we combine players from multiple sources in one stand-up?
Yes. You can import player names from an integration and freely blend them with custom names, guests, or rotating agile coaches directly within the player roster tools.

### What happens if an API token expires during a stand-up?
Daily Pick gracefully falls back to your cached player roster. Your meeting can proceed without interruption using the existing list while the facilitator updates credentials afterwards.

---

## Related Reading

- [How to Run Effective Daily Standup Meetings](/blog/how-to-run-effective-daily-standup-meetings/)
- [8 Best Standup Meeting Ideas for Remote & In-Office Teams](/blog/8-best-standup-meeting-ideas/)
- [Agile Retrospective Games: Complete Guide](/blog/agile-retrospective-games-complete-guide/)
- [Hybrid All-Hands Agendas That Keep Every Voice Engaged](/blog/hybrid-all-hands-playbook-fair-fun-agendas-that-keep-teams-engaged/)
