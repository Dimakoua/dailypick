---
title: "How to Connect GitHub to Daily Pick (PAT + Repository Guide)"
date: 2025-10-26
description: "Learn how to create a GitHub personal access token, scope it correctly, and sync collaborators plus open issues into Daily Pick."
layout: "post.njk"
tags: ["github", "daily pick", "integrations", "engineering productivity", "standups"]
canonical: "https://dailypick.dev/blog/connect-github-to-daily-pick/"
author: "Daily Pick"
updated: 2025-10-26
section: "Integrations"
keywords: "github personal access token, github integration guide, daily pick github, sync github issues to standup"
ogImage: "/assets/og-image-main.png"
ogImageAlt: "Daily Pick GitHub integration instructions displayed on dual monitors"
twitterImage: "/assets/og-image-main.png"
twitterImageAlt: "Daily Pick GitHub integration instructions displayed on dual monitors"
---

GitHub already tracks who owns each issue and which pull requests are waiting for review. When you hook GitHub into Daily Pick, the stand-up dock can automatically display collaborators, open issues, and quick links to “Open” so your team never hunts for context. Here’s the full walkthrough.

---

## Requirements

- Read access to the repository (private or public).
- Permission to create a **personal access token (classic or fine-grained)**.
- The repository slug in `owner/repo` format (e.g., `daily-pick/game-hub`).

Daily Pick only needs read access. You can keep two-factor auth enabled and still use the integration.

---

## Step 1 — Create a GitHub personal access token

1. Open [github.com/settings/tokens](https://github.com/settings/tokens) while signed into the correct account.
2. Choose **Fine-grained tokens** if available. Otherwise, select **Generate new token (classic)**.
3. Provide a descriptive name such as `Daily Pick Stand-up`.
4. Set an expiration (90 days is a solid default).
5. Scopes to enable:
   - **Fine-grained:** select the specific repository and grant **Metadata** + **Issues** read access.
   - **Classic:** check `repo` (read) and `read:org` if you need org-level member data.
6. Click **Generate token** and copy the string immediately.

---

## Step 2 — Complete the GitHub card in Daily Pick

1. Visit [Daily Pick Settings](/apps/settings/) → **Third-Party Integrations** → **GitHub**.
2. Enter:
   - **Repository full name:** `owner/repository` exactly as it appears in the URL.
   - **Personal access token:** the value you just generated.
3. Decide whether to enable:
   - **Include assigned work when testing** to fetch open issues (default recommended).
   - **Enable connection** to keep the Worker polling.

---

## Step 3 — Test, review, and save

1. Click **Test Connection**.
2. When the Worker responds you’ll see:
   - **Players detected:** collaborators or assignees that Daily Pick can map into the player roster.
   - **Assigned work:** open issues grouped by assignee with quick “Open” links.
3. Use the action buttons if you want to import players or store the issue snapshot.
4. Finish by clicking **Save Connection** so the Worker keeps the token server-side.

---

## Troubleshooting checklist

| Message | Likely cause | Fix |
| --- | --- | --- |
| `Not Found` | Repository slug typo or missing access | Confirm the `owner/repo` path, and verify the token was granted access to that repo. |
| `Bad credentials` | Token expired or copied incorrectly | Generate a new PAT and paste it again. |
| `Issues disabled for this repo` | Some repos turn off GitHub Issues | Re-enable Issues or connect another repo that uses them. |
| Empty player list | No collaborators are assigned to issues | Assign issues to teammates or use GitHub Projects to create ownership before re-testing. |

---

## Best practices after you connect

- **Rotate tokens when people change roles.** Delete the old PAT in GitHub Settings so you know exactly who has access.
- **Use a shared service account** if multiple facilitators manage stand-ups; keep personal accounts for emergency overrides only.
- **Leverage snapshots.** If a deploy freezes mid-sprint, click **Save assigned work snapshot** so the state is preserved for the retrospective.

With GitHub wired in, Daily Pick becomes your unified view: queue order, notes, and the exact issues each teammate is touching. Revisit [the Settings page](/apps/settings/) any time you want to switch repositories or revoke the connection.
