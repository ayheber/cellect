const PORTAL_ID = '145054770';
const FORM_ID = '5f4ba562-629b-477f-91dc-f0263c86b565';

export function submitToHubSpot(name: string, email: string): void {
  fetch(
    `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_ID}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: [
          { name: 'firstname', value: name },
          { name: 'email', value: email },
        ],
        context: {
          pageUri: window.location.href,
          pageName: 'Yuki Game',
        },
      }),
    }
  ).catch(() => {});
}
