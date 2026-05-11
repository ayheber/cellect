const PORTAL_ID = '145054770';
const FORM_ID = '5f4ba562-629b-477f-91dc-f0263c86b565';

export async function submitToHubSpot(
  firstname: string,
  lastname: string,
  email: string,
  jobtitle: string
): Promise<void> {
  const res = await fetch(
    `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_ID}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: [
          { name: 'firstname', value: firstname },
          { name: 'lastname', value: lastname },
          { name: 'email', value: email },
          { name: 'jobtitle', value: jobtitle },
          { name: 'lead_source_details', value: 'Gaming App 2026' },
          { name: 'n1__lead_record_type', value: 'Snowflake' },
        ],
        context: {
          pageUri: window.location.href,
          pageName: 'Yuki Game',
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`HubSpot submission failed: ${res.status}`);
  }
}
