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
        <p className="start-sub">Route falling queries to the right-sized warehouse.<br />Save more dollars than Yuki — if you can.</p>

        <div className="how-to-play">
          <p className="htp-heading">HOW TO PLAY</p>

          <div className="htp-row">
            <span className="htp-key">← →</span>
            <span className="htp-desc">Move query to the right warehouse</span>
          </div>
          <div className="htp-row">
            <span className="htp-key">↓</span>
            <span className="htp-desc">Fast drop · or tap your warehouse to drop instantly</span>
          </div>
          <div className="htp-row">
            <span className="htp-key">SPACE</span>
            <span className="htp-desc">Spin up a new warehouse of that size</span>
          </div>

          <div className="htp-divider" />

          <div className="htp-row">
            <span className="htp-bar-demo">
              {[0,1,2,3,4].map(i => (
                <span key={i} className={`htp-seg ${i <= 1 ? 'htp-seg-on' : 'htp-seg-off'}`} />
              ))}
            </span>
            <span className="htp-desc">Complexity bar — more filled = bigger WH needed</span>
          </div>

          <div className="htp-row">
            <div className="wh-row">
              {['XS','S','M','L','XL'].map(s => (
                <div key={s} className={`wh-badge wh-${s.toLowerCase()}`}>{s}</div>
              ))}
            </div>
            <span className="htp-desc">Match query → warehouse to save the most $</span>
          </div>

          <div className="htp-divider" />

          <p className="how-hint">Wrong WH or full queue = lose a life · 3 lives total</p>
          <p className="how-hint">Spin up when your WH is full — same as Yuki does 24/7</p>
        </div>

        <form onSubmit={handleSubmit} className="start-form">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
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
          <button type="submit" className="start-btn">
            Start Game →
          </button>
        </form>
      </div>
    </div>
  );
}
