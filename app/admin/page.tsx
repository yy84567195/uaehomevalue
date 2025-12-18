export default function AdminPage() {
  return (
    <div className="card cardPad">
      <h1 className="h1" style={{fontSize:34}}>Admin (MVP)</h1>
      <p className="p">
        This MVP stores leads in Supabase when configured. For now, use Supabase dashboard to view the table.
      </p>

      <div className="hr" />
      <div className="alert" style={{whiteSpace:'pre-wrap'}}>
{`Setup (once):
1) Create a Supabase project
2) Create table "leads" (SQL in README)
3) Add env vars on Vercel:
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_WHATSAPP_NUMBER`}
      </div>

      <div className="hr" />
      <p className="small">
        Later we can build a proper password-protected admin UI that reads leads via a secure API.
      </p>
    </div>
  );
}
