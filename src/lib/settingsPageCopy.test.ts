import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');
const settingsPageSource = readFileSync(resolve(process.cwd(), 'src/pages/MyPage.tsx'), 'utf8');

describe('settings page copy', () => {
  it('renames the my tab to settings', () => {
    expect(appSource).toContain("{ id: 'my', label: '설정', icon: Settings }");
    expect(appSource).not.toContain("{ id: 'my', label: '마이', icon: Settings }");
  });

  it('shows account deletion copy with a confirmation popup', () => {
    expect(settingsPageSource).toContain('<h1>설정</h1>');
    expect(settingsPageSource).toContain('회원탈퇴');
    expect(settingsPageSource).toContain('window.confirm');
    expect(settingsPageSource).toContain('deleteCurrentAccount(supabase)');
  });
});
