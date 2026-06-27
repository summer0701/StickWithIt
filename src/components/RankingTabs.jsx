const tabs = [
  { id: 'distance', label: '거리' },
  { id: 'pace', label: '페이스' },
  { id: 'growth', label: '성장' },
];

export default function RankingTabs({ activeTab, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label="랭킹 탭">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={activeTab === tab.id ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
