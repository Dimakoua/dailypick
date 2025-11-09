---
title: "How to Connect Jira to Daily Pick (API Token Guide)"
date: 2025-10-26
description: "Follow this step-by-step Jira guide to generate an API token, choose the right project, and stream players plus assignments into Daily Pick."
layout: "post.njk"
tags: ["jira", "daily pick", "standup automation", "team productivity", "integrations"]
canonical: "https://dailypick.dev/blog/connect-jira-to-daily-pick/"
author: "Daily Pick"
updated: 2025-10-26
section: "Integrations"
keywords: "jira api token, jira integration guide, daily pick jira, connect jira to standup tool"
ogImage: "/assets/og-image-main.png"
ogImageAlt: "Daily Pick Jira integration instructions displayed on a laptop"
twitterImage: "/assets/og-image-main.png"
twitterImageAlt: "Daily Pick Jira integration instructions displayed on a laptop"
---

Daily Pick can pull your Jira players, queues, and assignment snapshots so the stand-up dock always knows who is up next and what they are shipping. This guide walks through the exact clicks inside Atlassian, how to configure the integration card inside **Settings → Third-Party Integrations**, and what to do if something fails along the way.

---

## What you need before you start

- Atlassian Cloud access to the projects you want to mirror.
- Permission to create Jira API tokens (standard for most accounts).
- The Jira base URL (often `https://yourteam.atlassian.net`).
- The short project key that appears in issue IDs (e.g., `DP` in `DP-142`).

> **Heads-up:** Daily Pick stores the API token on its Worker, not in your browser. You can safely close the tab after saving.

---

## Step-by-step: create the Jira API token

1. **Open Atlassian security settings**  
   Go to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) while you are signed into Atlassian.

2. **Create a fresh token**  
   Click **Create API token**, give it a descriptive label such as `Daily Pick Stand-up`, and press **Create**.

3. **Copy the token immediately**  
   Atlassian only displays the string once. Copy it and keep the browser tab open until you finish the Daily Pick form.

---

## Configure the Jira integration card in Daily Pick

1. Open [Daily Pick Settings](/apps/settings/) and scroll to **Third-Party Integrations**.
2. Select **Jira** in the navigation rail.
3. Fill out the fields:
   - **Jira site URL:** the base domain where you access Jira Cloud.
   - **Project key:** the short code (e.g., `DP`). You can update this later to switch projects.
   - **Account email:** the Atlassian login tied to the token.
   - **API token:** paste the value you just copied.
4. Choose whether to enable the toggle:
   - **Enable connection:** keep this on so scheduled refreshes occur.
   - **Include assigned work when testing:** turn this on if you want Daily Pick to fetch each teammate’s active issues and attach them to the stand-up panel.

---

## Test and save the connection

1. Click **Test Connection**. Daily Pick will contact a Worker endpoint with your client ID.
2. Review the preview card:
   - **Players detected** shows which teammates will be merged into the Player List.
   - **Assigned work** summarizes issues per teammate. Use the action buttons to update players or save a snapshot.
3. If everything looks correct, press **Save Connection**. The Worker stores the token and configuration so every device you use stays in sync.

---

## Troubleshooting common errors

| Error message | How to fix it |
| --- | --- |
| `Unable to reach Jira` | Verify the base URL is correct and accessible from the public internet. |
| `Unauthorized (401)` | Regenerate the API token and confirm the email matches the account that created it. |
| `Project key not found` | Double-check the key spelling. You can test with another project to isolate permission issues. |
| `No players detected` | Make sure the project has active assignees. You can still import players manually and re-test later. |

Still blocked? Toggle **Include assigned work** off and re-run the test to confirm the token works, then re-enable it after the permission issue is resolved.

---

## Keep your integration healthy

- **Rotate tokens every few months.** Delete the old token in Atlassian and paste the new one into Daily Pick, then click **Save Connection**.
- **Use a dedicated service account** if multiple facilitators rely on the integration. That prevents accidental token revocation when someone leaves the team.
- **Refresh before the stand-up.** Click the **Refresh** button inside the stand-up dock to pull the latest assignments if you know big changes landed overnight.

With Jira linked, Daily Pick can act as your real-time queue coordinator—no more copying names from a spreadsheet before the meeting. Jump into the [Settings page](/apps/settings/) whenever you need to tweak the connection.
