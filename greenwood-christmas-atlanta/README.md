# Greenwood Star Christmas Party — RSVP (Atlanta)

The RSVP form is a big ornament in the middle of the screen, with the Christmas tree behind it. Guests enter their name and email, say whether they're going and how many guests they're bringing, and pick a color and pattern. When they press **Send RSVP**, their ornament flies into the tree with their name on it. The tree starts bare and fills up as people RSVP.

Next.js 16 · React 19 · Tailwind CSS 4 · Motion

## Deploy on Vercel

1. Push this folder to a GitHub repo and import it in Vercel.
2. In the project, open **Storage → Create Database → Upstash for Redis** (free tier is fine) and connect it to the project. This adds the `KV_REST_API_*` variables.
3. In **Settings → Environment Variables**, add `ADMIN_KEY` (a long random string).
4. Redeploy.

Without a connected database the site shows an error instead of losing RSVPs.

## Edit the party details

Edit `config/party.ts` to set the date, time, venue, RSVP-by date, the highlights shown under the title (cocktails, casino games, live music…) and the most guests one person can bring.

This site is for **Atlanta only**. San Antonio is a separate copy of the site (its own folder and its own Vercel project). Both can use the same Upstash database: each office's RSVPs are stored under its own key.

## Admin

Go to `/admin` and enter your `ADMIN_KEY` to see head counts and download a CSV.

## Local development

```bash
npm install
cp .env.example .env.local   # set ADMIN_KEY
npm run dev
```

Locally, RSVPs are saved to `data/rsvps.json` unless Redis variables are set.

## Notes

- **One RSVP per email.** Guests can edit their RSVP in the same browser, or with the private edit link they can copy after saving.
- **Privacy:** the public tree only shows first names, colors and patterns.
- **Placement:** each tree has 179 fixed spots. They're filled in an order that spreads ornaments evenly over the tree, and each ornament keeps its spot. A database lock stops two people from getting the same spot.
- **Reduced motion:** if a guest has reduced motion turned on in their device settings, there's no snow or flying animation.
- **Logo:** the white Greenwood Star logo is in `public/`.
