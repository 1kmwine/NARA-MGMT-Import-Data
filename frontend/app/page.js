'use client';

import { useEffect, useState } from 'react';
import { fetchSnapshot } from './lib/liquorData';
import Dashboard from './Dashboard';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8010';

export default function Page() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSnapshot(API_BASE).then(setSnapshot).catch(e => setError(e.message));
  }, []);

  if (error) {
    return <div style={{ padding: 32, fontFamily: 'sans-serif' }}>데이터를 불러오지 못했습니다: {error}</div>;
  }
  if (!snapshot) {
    return <div style={{ padding: 32, fontFamily: 'sans-serif' }}>불러오는 중…</div>;
  }
  return <Dashboard {...snapshot} apiBase={API_BASE} />;
}
