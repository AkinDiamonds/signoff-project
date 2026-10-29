# 11 — The video

**Goal:** a public YouTube video under three minutes that shows the product working end to end, makes the problem land, and makes the signing limit memorable.
**Time:** 6 hours across two days.
**Before you start:** Stages 5-10 done. The deployed app is stable. Five fresh disputes are pooled.

---

## What the rules require

These are hard requirements, not style advice:

- Under **3 minutes**. Judges are not required to watch past three.
- Footage that shows the project **functioning on the device it was built for**.
- Uploaded to **YouTube**, publicly visible, link on the submission form.
- **No third-party trademarks** and **no copyrighted music** unless you have permission.
- In English.

On trademarks: you may *name* PayPal and show PayPal's own checkout, because the project integrates it. Do not use third-party logos, brand fonts, or product screenshots from other companies. Shopify screenshots from Stage 7's reference pack must **not** appear in the video.

## What the judging criteria reward

Presentation is one of five equally weighted criteria, and it is the one a judge forms an opinion from first. The video must answer, in order: what problem, for whom, why it matters, and does it actually work.

---

## Step 1 — Prepare the stage (60 min)
**YOU.** Do all of this the day you record, not before.

1. Fresh disputes: run the Stage 6 Part H checklist. Five pooled, each with more than a third of its window left.
2. Warm the services: open each URL once so Render has no cold start during the take. Do this ten minutes before recording, and again five minutes before.
3. Close everything else on your machine. Notifications off. Do Not Disturb on.
4. Browser: one window, no bookmarks bar, one tab. Zoom 125% so text is legible at 1080p.
5. Phone: same accounts signed in, brightness at maximum, screen recording ready.
6. `llm_mode` is `LIVE` — check `/api/status`.

## Step 2 — Record the screen cleanly (30 min)
**YOU.** Use OBS or the OS recorder at 1080p, 30fps. Record the **whole session in one take** if you can, then cut. Separate takes break continuity and hide bugs.

When you click, move the pointer deliberately and pause for half a second before and after each click.

## Step 3 — The beat sheet

Target 2:40. Hard stop 3:00.

| Time | Beat | What is on screen | What is said |
|---|---|---|---|
| 0:00-0:12 | Hook | The dispute detail page, timeline already partly filled | "A $38 dispute. Two days left. The tracking number that wins it is in an email nobody read." |
| 0:12-0:30 | Problem | Landing page hero, then scroll to the numbers | What a small seller does today, and what it costs. One number, sourced. |
| 0:30-0:40 | What Signoff is | Landing page, how-it-works block | "Signoff is a dispute clerk that only signs what you have authorized." Name the signing limit here — it is the idea. |
| 0:40-1:20 | It works | **Live**: `/app/pool` → click a pooled dispute → timeline fills | Narrate the four stages as they appear. Point at the source label on each evidence row. |
| 1:20-1:50 | The limit bites | The large dispute → **Open approval card** → phone → approve | "The rules would not let it refund $180 on its own. It asked. I signed." Do this on the phone, camera on the hand. |
| 1:50-2:10 | It refuses | The injection dispute | Show the buyer message asking for money, then the recorded decision refusing it, with the rule id. "The model proposed. The rules refused. The log kept both." |
| 2:10-2:30 | Not just a demo | Dashboard → ask one question in the Studio assistant → answer | "Same data, asked in plain English." Then 3 seconds on the Evidence card showing a store source. |
| 2:30-2:45 | How it connects | Landing page store section, or the guide's table | One sentence on the adapter. One sentence on what is real versus simulated. |
| 2:45-2:55 | Close | Title card with the URL | Who it is for and what to try first. |

**Do not** read a feature list. Every sentence should be a thing happening on screen.

## Step 4 — Where the honesty goes
**YOU.** Say these out loud, briefly. Judges reward candour and punish the opposite:

- At 0:40, when the dispute is running: "This is the real PayPal sandbox."
- At 2:30: "The shop is a demo store; the disputes are real sandbox disputes."
- If any part is cached reasoning, say so when it appears. The UI labels it already; do not record over the label.

## Step 5 — Edit (120 min)
**YOU.**

1. Cut every pause over one second and every "um".
2. Add captions by hand or with YouTube's auto-captions reviewed for errors. Misspelled product names read as carelessness.
3. Add at most four text callouts, each under six words, at the moments that matter: "rules decided", "you signed", "blocked".
4. No music, or music you have a licence for and can prove. Silence is safer.
5. No third-party logos. Check every frame.
6. Export 1080p.

## Step 6 — Publish (30 min)
**YOU.**

1. Upload to YouTube. Title: "Signoff — PayPal disputes handled inside limits you set".
2. Visibility **Public**, not unlisted.
3. Description: two sentences, the live URL, the repo URL, and "built for the PayPal AI Hackathon".
4. Open the link in a logged-out browser and confirm it plays at 1080p.
5. Copy the URL into `README.md`, `/guide`, and the submission draft.

## Step 7 — Check the submission requirements against the video
**YOU.**

- [ ] Under 3:00 as shown by YouTube
- [ ] Public and playable logged out
- [ ] Shows the app running, not slides
- [ ] Shows it on a phone as well as desktop
- [ ] No third-party trademarks beyond PayPal
- [ ] No unlicensed music
- [ ] Captions present
- [ ] Every claim in the narration has a claims-ledger row

---

## Done when

All seven boxes above are ticked, and you have watched the finished video once, start to finish, on a phone, without touching anything.

---

## If it goes wrong

**A dispute gets claimed by a webhook mid-take.** Hold mode is off. Re-check `DEMO_HOLD_DISPUTES`.

**The agent is slow and there is dead air.** Cut the wait in the edit and put a one-line callout over it. Do not fake the speed.

**The LLM falls back to cached reasoning.** The provider failed. Check `/api/status` and re-run with a fresh dispute.

---

## Cut

Never cut: the approval on the phone, the injection refusal, the source labels on evidence.
Cut first: the numbers beat (fold one number into the hook), the dashboard beat (keep three seconds), the close.
