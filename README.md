# 🩺 FollowUp Bot

**AI-powered patient follow-up reminder system for Pakistani clinics.**

Doctor sends a voice note → Bot enrolls the patient → Bot calls patient 1 day before appointment → Bot reports results back to doctor.

---

## How It Works

### 1. Doctor Enrolls Patient (WhatsApp Voice Note)

Doctor sends a voice note to the bot's WhatsApp number:

> *"Akhtar sahib, 0300-1234567, BP follow-up do hafte baad"*

Bot responds in 5 seconds:

> ✅ Done.
> Patient: Akhtar
> Phone: 0300-1234567
> Follow-up: Monday, November 18th 4:00 PM
> Reason: BP review
>
> I'll contact them one day before. Reply "cancel" to undo.

### 2. Bot Calls Patient (1 Day Before)

Automated call in Urdu:

> *"Assalam-o-Alaikum, Akhtar sahib. Yeh Dr. Ahmed ki clinic se reminder hai..."*

Three branches:
- **Yes → confirms** appointment, texts doctor
- **No → offers reschedule** or asks if they need help
- **No answer → retries** up to 3 times

### 3. Doctor Gets Summary (WhatsApp)

Evening message:

> 📋 Tomorrow's follow-ups
> ✅ Confirmed: 6
> 📅 Rescheduled: 2
> ❌ Cancelled: 1
> 📵 Unreachable: 1

---

## Tech Stack

| Component | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL) |
| Voice Notes | WhatsApp Business Cloud API |
| Transcription | OpenAI Whisper |
| AI Brain | Claude Haiku (extraction + conversation) |
| Phone Calls | Twilio Voice |
| Hosting | Vercel |
| Cron Jobs | Vercel Cron |

---

## Project Structure

```
followup-bot/
├── app/
│   ├── api/
│   │   ├── whatsapp/webhook/    # Receives doctor voice notes
│   │   ├── twilio/
│   │   │   ├── voice/           # Initial TwiML when patient picks up
│   │   │   ├── response/        # Handles patient speech replies
│   │   │   └── status/          # Call status callbacks
│   │   └── cron/
│   │       ├── call-patients/   # Daily: calls tomorrow's follow-ups
│   │       └── daily-summary/   # Daily: WhatsApps doctor the results
│   ├── dashboard/               # Doctor's web dashboard
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── supabase.ts              # DB client + types
│   ├── phone.ts                 # Pakistani phone number normalizer
│   ├── whisper.ts               # OpenAI Whisper wrapper
│   ├── extraction.ts            # Claude prompt for voice note → structured data
│   ├── conversation.ts          # 3-branch patient call logic
│   ├── whatsapp.ts              # WhatsApp Cloud API client
│   └── twilio.ts                # Twilio call initiation
├── supabase/
│   └── schema.sql               # Full database schema
├── .env.example                 # All required env vars
└── vercel.json                  # Cron schedules
```

---

## Setup Guide

### Step 1: Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor → paste contents of `supabase/schema.sql` → Run
3. Copy your project URL and keys to `.env.local`

### Step 2: WhatsApp Business API

**Option A: Meta Direct (cheaper, takes 1-2 weeks)**
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a Business App → Add WhatsApp product
3. Set up a phone number (or use the test number)
4. Configure webhook URL: `https://your-domain.com/api/whatsapp/webhook`
5. Subscribe to `messages` webhook field
6. Copy Access Token and Phone Number ID to `.env.local`

**Option B: Wati / Interakt (faster, ~$40/month)**
1. Sign up at [wati.io](https://wati.io) or [interakt.shop](https://interakt.shop)
2. They handle the Meta verification for you
3. Set webhook URL to your endpoint
4. Modify `lib/whatsapp.ts` to use their API format

### Step 3: OpenAI (Whisper)

1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. Add to `.env.local` as `OPENAI_API_KEY`

### Step 4: Anthropic (Claude)

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Add to `.env.local` as `ANTHROPIC_API_KEY`

### Step 5: Twilio (Voice Calls)

1. Sign up at [twilio.com](https://twilio.com)
2. Buy a phone number with voice capability
   - For Pakistan: you may need a US/UK number that can call Pakistan
   - Twilio charges ~$0.02/min for Pakistan calls
3. Copy Account SID, Auth Token, and phone number to `.env.local`

### Step 6: Deploy

```bash
# Install dependencies
npm install

# Create .env.local from template
cp .env.example .env.local
# Edit .env.local with your actual keys

# Local dev (use ngrok for webhook testing)
npm run dev
ngrok http 3000
# Update TWILIO_WEBHOOK_BASE_URL with your ngrok URL

# Deploy to Vercel
vercel deploy --prod
```

### Step 7: Register Your Doctor

Insert your cardiologist's info into the `doctors` table via Supabase dashboard:

```sql
INSERT INTO doctors (name, clinic_name, phone, language)
VALUES ('Dr. Ahmed', 'Ahmed Cardiology Clinic', '+923XXXXXXXXX', 'ur');
```

The phone number must match the WhatsApp number the doctor will send voice notes from.

---

## Costs (Per Month at 100 Patients)

| Service | Cost |
|---|---|
| Supabase | Free tier |
| Vercel | Free tier |
| OpenAI Whisper | ~$0.60 (100 voice notes × 10 sec avg) |
| Claude Haiku | ~$0.50 (200 API calls) |
| Twilio Voice | ~$20 (100 calls × 1 min avg to Pakistan) |
| WhatsApp API | ~$5 (Meta conversation fees) |
| **Total** | **~$26/month** |

At $50/month per doctor, you're profitable from doctor #1.

---

## Key Files to Iterate On

### `lib/extraction.ts` — The enrollment prompt
This is the #1 thing you'll tweak during pilot. Every time your cardiologist's voice
note gets misunderstood, add a rule to the prompt. Common iterations:
- Date parsing for informal Urdu ("jab time mile", "Jumma ke baad")
- Name spelling variations
- Background noise handling (add Whisper prompt hints)

### `lib/conversation.ts` — The call script
Your cardiologist should review the opening line and the 3 branches.
Culture-specific things to get right:
- Level of formality (sahib/sahiba, aap vs tum)
- When to escalate to "doctor will call you"
- How to handle cost objections gracefully

---

## V2 Roadmap

- [ ] ElevenLabs Urdu voice (much better than Twilio's built-in)
- [ ] Google Calendar integration for real slot availability
- [ ] Patient SMS fallback for those without WhatsApp
- [ ] Multi-clinic support with auth (Supabase Auth)
- [ ] Medication refill reminders (upsell feature)
- [ ] Analytics: no-show rate before/after bot, recovery rate
- [ ] DRAP compliance documentation

---

## License

Private — not open source yet. Built for pilot deployment.
