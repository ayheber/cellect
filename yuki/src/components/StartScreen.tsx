import { useState, FormEvent } from 'react';
import { submitToHubSpot } from '../hubspot';

interface Props {
  onStart: (name: string) => void;
}

export function StartScreen({ onStart }: Props) {
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [jobtitle, setJobtitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await submitToHubSpot(firstname.trim(), lastname.trim(), email.trim(), jobtitle.trim());
      onStart(`${firstname.trim()} ${lastname.trim()}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="start-screen">
      <div className="start-card">
        <div className="start-logo">YUKI</div>
        <h1 className="start-title">Query Drop</h1>
        <p className="start-sub">Route falling queries to the right-sized warehouse.<br />Can you out-save the AI?</p>

        <form onSubmit={handleSubmit} className="start-form">
          <input
            type="text"
            placeholder="First name"
            value={firstname}
            onChange={e => setFirstname(e.target.value)}
            required
            className="start-input"
            autoFocus
          />
          <input
            type="text"
            placeholder="Last name"
            value={lastname}
            onChange={e => setLastname(e.target.value)}
            required
            className="start-input"
          />
          <input
            type="email"
            placeholder="Work email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="start-input"
          />
          <input
            type="text"
            placeholder="Job title"
            value={jobtitle}
            onChange={e => setJobtitle(e.target.value)}
            required
            className="start-input"
          />
          {error && <p className="start-error">{error}</p>}
          <button type="submit" className="start-btn" disabled={loading}>
            {loading ? 'Starting…' : 'Start →'}
          </button>
        </form>
      </div>
    </div>
  );
}
