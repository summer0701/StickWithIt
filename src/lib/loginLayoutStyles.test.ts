import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

function cssRule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm'));
  return match?.[1] ?? '';
}

describe('login layout styles', () => {
  it('keeps the login screen horizontal padding symmetric, including safe area insets', () => {
    const screenRule = cssRule('.stick-login-screen');

    expect(screenRule).toContain('--login-screen-padding-x: max(');
    expect(screenRule).toContain('calc(20px + var(--app-safe-area-inset-left))');
    expect(screenRule).toContain('calc(20px + var(--app-safe-area-inset-right))');
    expect(screenRule).toContain('padding: max(22px, var(--app-safe-area-inset-top)) var(--login-screen-padding-x)');
  });

  it('centers the login panel without horizontal transform offsets', () => {
    const panelRule = cssRule('.stick-login-panel');

    expect(panelRule).toContain('width: min(100%, 420px)');
    expect(cssRule('.stick-login-screen')).toContain('--login-visual-center-offset-x: 32px');
    expect(panelRule).toContain('right: var(--login-visual-center-offset-x)');
    expect(panelRule).toContain('transform: scale(var(--login-scale))');
    expect(panelRule).not.toContain('translateX');
  });

  it('keeps form controls aligned to the same full-width edges', () => {
    expect(cssRule('.stick-auth-form')).toContain('width: 100%');
    expect(cssRule('.stick-outline-login')).toContain('width: 100%');
  });
});
