import { useState, FormEvent } from 'react';

interface Props {
  onStart: (name: string, email: string) => void;
}

export function StartScreen({ onStart }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && email.trim()) {
      onStart(name.trim(), email.trim());
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
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="start-input"
            autoFocus
          />
          <input
            type="email"
            placeholder="Work email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="start-input"
          />
          <button type="submit" className="start-btn">
            Start →
          </button>
        </form>
      </div>
    </div>
  );
}
