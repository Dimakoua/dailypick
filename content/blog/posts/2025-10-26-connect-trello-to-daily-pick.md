---
title: "How to Connect Trello to Daily Pick (API Key + Token Walkthrough)"
date: 2025-10-26
description: "Detailed instructions for generating a Trello API key and token, selecting the right board or list, and syncing cards into Daily Pick."
layout: "post.njk"
tags: ["trello", "daily pick", "integrations", "team productivity", "standup automation"]
canonical: "https://dailypick.dev/blog/connect-trello-to-daily-pick/"
author: "Daily Pick"
updated: 2025-10-26
section: "Integrations"
keywords: "trello api key, trello token guide, connect trello to standup, daily pick trello integration"
ogImage: "/assets/og-image-main.png"
ogImageAlt: "Daily Pick Trello integration instructions on a tablet"
twitterImage: "/assets/og-image-main.png"
twitterImageAlt: "Daily Pick Trello integration instructions on a tablet"
---

Trello is perfect for quick stand-up snapshots—cards already encode what each teammate is moving forward. When you connect Trello to Daily Pick, you can import members into the Player List **and** capture a 15-card snapshot of the board or list that matters most. This guide covers every click you need to copy the API key, generate the access token, and wire it into the Settings page.

---

## Before you begin

- A Trello account with read access to the board or list you care about.
- The board URL (e.g., `https://trello.com/b/abcdef12/sprint-15`).
- A few minutes to generate the API key and token on trello.com.

> **Security note:** Just like other Daily Pick integrations, tokens never live in `localStorage`. They’re sent to the Worker and stored server-side.

---

## Step 1 — Copy your Trello API key

1. While logged into Trello, open [trello.com/app-key](https://trello.com/app-key).
2. The page shows a 32-character “Key”. Click **Copy Key**.
3. Leave this tab open; you’ll need to generate the token from the same page.

---

## Step 2 — Generate a read-only Trello token

1. On the same **app-key** page, scroll down to the **Token** section.
2. Click the hyperlink that reads “click here” to generate a token, or press the **Open token generator** button inside the Daily Pick form.
3. Trello will ask for permissions. Approve the request (Daily Pick only needs read access).
4. Copy the long token value—just like Jira, Trello only displays it once.

---

## Step 3 — Fill out the Trello card inside Daily Pick

1. Visit [Daily Pick Settings](/apps/settings/) and choose the **Trello** tab in the integration rail.
2. Paste the following values:
   - **Board or list URL:** the direct link to the board/list you want to sync.
   - **API key:** the value from Step 1.
   - **API token:** the value from Step 2.
3. Flip on **Enable connection**.  
   Optional: enable **Include assigned work when testing** to pull cards for each person.

---

## Step 4 — Test the Trello connection

1. Click **Test Connection**.
2. Daily Pick queries Trello using your client ID. When the request completes you’ll see:
   - **Players detected:** members on the board or list.
   - **Assigned work:** up to 15 cards with the board/list source labels.
3. Use the action buttons:
   - **Update Player List** adds any new Trello members to the roster.
   - **Save assigned work snapshot** stores the card data so the stand-up dock can show it later, even offline.
4. Select **Save Connection** once the preview matches what you expect.

---

## Troubleshooting tips

| Symptom | Fix |
| --- | --- |
| `invalid key` | Double-check that you copied the full 32 characters from `trello.com/app-key`. |
| `token error` | Tokens expire if you revoke them from the Atlassian-esque security page. Generate a new one and re-test. |
| Board members missing | Ensure the people you expect are actually members of the board, not just card guests. |
| Cards lack assignees | Assign each card to the teammate who owns it; Trello won’t report “unassigned” work otherwise. |

Need multiple boards? Repeat the process with a different URL, or temporarily swap the board URL before pressing **Test Connection**.

---

## Keep the Trello integration tidy

- **Rotate tokens if someone leaves the company.** Generate a fresh token under the remaining admin’s account.
- **Use custom views.** Daily Pick respects filtered lists if you point to a list URL instead of the parent board.
- **Limit snapshots to 15 cards** for clarity. The stand-up panel intentionally caps the list so updates stay digestible.

Bookmark [the Settings page](/apps/settings/) for next time—you can revisit it at any point to refresh or disconnect the Trello integration.
