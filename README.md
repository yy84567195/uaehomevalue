# UAEHomeValue — MVP (Dubai, English)

This is a starter MVP for a consumer home value range website:
- Home page: input community/type/bedrooms/size
- Result page: value range + WhatsApp CTA
- Lead capture API: optional Supabase storage

## 0) Prerequisites
- Install Node.js (LTS) on your computer
- Create accounts:
  - GitHub (optional but recommended)
  - Vercel (for hosting)
  - Supabase (for saving leads)

## 1) Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000

## 2) Configure WhatsApp number
Create `.env.local` in project root:
```bash
NEXT_PUBLIC_WHATSAPP_NUMBER=9715XXXXXXXX
```

## 3) (Optional) Save leads to Supabase
### Create table
In Supabase SQL editor, run:

```sql
create table if not exists public.leads (
  id bigserial primary key,
  created_at timestamptz default now(),
  name text,
  whatsapp text,
  notes text,
  area text,
  type text,
  beds int,
  size_sqft int,
  estimate_min numeric,
  estimate_max numeric
);
```

### Add environment variables
In Vercel project settings -> Environment Variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`  (server-side only)
- `NEXT_PUBLIC_WHATSAPP_NUMBER`

## 4) Deploy on Vercel (no-code steps)
1. Create a new project on Vercel
2. Import this project from GitHub OR upload manually
3. Add env vars (above)
4. Deploy

## 5) Connect your domain
In Vercel: Project -> Settings -> Domains
Add: uaehomevalue.com
Follow Vercel's DNS instructions.

## 6) Replace starter data
Edit `data/price_ranges.json`:
- Add communities and min/max AED ranges
- Add comps examples (optional)

## Notes
- This MVP intentionally shows a RANGE, not a single price.
- It is NOT an official valuation product. Keep the disclaimer in the footer.
