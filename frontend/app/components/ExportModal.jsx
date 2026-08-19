'use client';

import { useState } from 'react';
import { Button } from './Button';

const SECTIONS = [
  { key: 'kpi', label: 'KPI 요약 (수입액·중량·단가·비중)' },
  { key: 'trend', label: '월별 수입 추이' },
  { key: 'ranking', label: '국가별 순위' },
  { key: 'composition', label: '세부 주종 비중' },
  { key: 'countryTable', label: '국가별 수입 표' },
];

export function ExportModal({ open, onClose, onExport }) {
  const [selected, setSelected] = useState(() => Object.fromEntries(SECTIONS.map(s => [s.key, true])));
  const [format, setFormat] = useState('excel');

  if (!open) return null;

  const toggle = key => setSelected(cur => ({ ...cur, [key]: !cur[key] }));
  const anySelected = Object.values(selected).some(Boolean);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div className="card elev-sm" style={{ width: 380, padding: 24 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px' }}>내보내기</h3>
        <p className="text-muted" style={{ fontSize: 12, margin: '0 0 16px' }}>포함할 데이터를 선택하세요.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {SECTIONS.map(s => (
            <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!selected[s.key]} onChange={() => toggle(s.key)} />
              {s.label}
            </label>
          ))}
        </div>

        <div className="seg" style={{ width: '100%', marginBottom: 20 }}>
          <button type="button" className="seg-opt" style={{ border: 'none', flex: 1, justifyContent: 'center', background: format === 'excel' ? 'var(--color-accent-soft)' : 'transparent', color: format === 'excel' ? 'var(--color-accent-hover)' : 'var(--color-text-primary)', fontWeight: format === 'excel' ? 600 : 400 }} onClick={() => setFormat('excel')}>Excel</button>
          <button type="button" className="seg-opt" style={{ border: 'none', flex: 1, justifyContent: 'center', background: format === 'pptx' ? 'var(--color-accent-soft)' : 'transparent', color: format === 'pptx' ? 'var(--color-accent-hover)' : 'var(--color-text-primary)', fontWeight: format === 'pptx' ? 600 : 400 }} onClick={() => setFormat('pptx')}>PPT</button>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>취소</Button>
          <Button variant="secondary" size="sm" disabled={!anySelected} onClick={() => onExport(format, selected)}>내보내기</Button>
        </div>
      </div>
    </div>
  );
}
