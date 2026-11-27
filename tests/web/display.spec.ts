import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
// Every part of the design preview shows the amount the app shows: widget (lock screen, home) and Live Activity (card, Dynamic Island).
const amounts = ['lock-widget-amount', 'home-widget-amount', 'activity-amount', 'island-compact-amount'];
const openSettings = async (page: Page) => {
  const tab = page.getByRole('tab', { name: '설정' });
  await tab.click();
  // Today has the same link; wait for the lazy settings route before choosing it.
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible();
};
const openDisplay = async (page: Page, scenario = 'default') => {
  await page.goto(`/?scenario=${scenario}`);
  await openSettings(page);
  await page.getByRole('link', { name: '잠금화면 설정하기' }).click();
  await expect(page.getByRole('heading', { name: '잠금화면 표시' })).toBeVisible();
};
const fits = async (page: Page, amount: Locator) => {
  expect(await amount.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const box = await amount.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
};

test('the preview is labelled as a design preview and shows the app amount, phrase and base in every form', async ({ page }, info) => {
  await openDisplay(page);
  await expect(page.getByRole('heading', { name: '디자인 미리보기' })).toBeVisible();
  await expect(page.getByText('실제 위젯이 아니에요. iPhone에서 가능한 기능이고, 여기서는 화면 디자인만 보여줘요.')).toBeVisible();
  for (const id of amounts) await expect(page.getByTestId(id)).toHaveText('32,400원');
  for (const id of ['home-widget', 'activity', 'lock-widget']) await expect(page.getByTestId(id).getByText('오늘 좀 쓰는데?')).toBeVisible();
  for (const id of ['home-widget', 'activity']) await expect(page.getByTestId(id).getByText('하루 기준 50,000원')).toBeVisible();
  await expect(page.getByTestId('island-minimal')).toBeVisible();
  // The preview never claims a widget was installed or is showing.
  await expect(page.getByText(/설치했|설치됐|설치되었|표시 중이에요|표시됐/)).toHaveCount(0);
  expect(await noOverflow(page)).toBe(true);
  await page.screenshot({ path: `test-results/display-${info.project.name}.png`, fullPage: true });
});

// The web has no Dynamic Type; 160 CSS px is a 320px screen at 200%. Real iOS large text on the widget/Activity is a device check.
test.describe('at 200% enlargement (160 CSS px)', () => {
  test.use({ viewport: { width: 160, height: 740 } });
  for (const scenario of ['default', 'maximum']) {
    test(`${scenario}: amounts, scenario picker and restart are not cut off`, async ({ page }) => {
      await openDisplay(page, scenario);
      for (const id of amounts) await fits(page, page.getByTestId(id));
      for (const target of [page.getByLabel('미리보기 시나리오'), page.getByRole('button', { name: '다시 시작' })]) {
        const box = await target.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(160);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      expect(await noOverflow(page)).toBe(true);
    });
  }
});

// A fixed Korean notice, not a midnight calculation: the real day change is decided by the Swift widget (day != today, isStale).
test('the static notice for a Live Activity after the date changed is shown', async ({ page }) => {
  await openDisplay(page);
  const expired = page.getByTestId('activity-expired');
  await expect(expired.getByTestId('activity-expired-amount')).toHaveText('0원');
  await expect(expired.getByText('날짜가 바뀌었어요 · 앱에서 새로고침')).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
});

for (const [scenario, amount, phrase] of [['empty', '0원', '아직은 여유 있네'], ['carried', '15,000원', '아직은 여유 있네'], ['maximum', '25,200,470,046,051,300원', '님 부자임?']] as const) {
  test(`fixture ${scenario} keeps the whole amount and its phrase`, async ({ page }) => {
    await openDisplay(page, scenario);
    for (const id of amounts) {
      const element = page.getByTestId(id);
      await expect(element).toHaveText(amount);
      await fits(page, element);
    }
    await expect(page.getByTestId('home-widget').getByText(phrase)).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
  });
}

test('an amount changed in the app shows up in the preview and turns to the exceeded phrase', async ({ page }) => {
  // A cold settings route leaves the same-named link on Today visible until its bundle arrives.
  await page.route(/\/settings-[\w-]+\.js$/, async route => {
    const response = await route.fetch();
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ response });
  });
  await page.goto('/');
  await page.getByRole('link', { name: '오늘의 범행 기록 보기' }).click();
  await page.getByRole('button', { name: '자백하기' }).click();
  await page.getByLabel('금액(원)').fill('20000');
  await page.getByRole('button', { name: '자백', exact: true }).click();
  await expect(page.getByTestId('spending-total')).toHaveText('52,400원');
  await page.getByRole('button', { name: '뒤로' }).click();
  await openSettings(page);
  await page.getByRole('link', { name: '잠금화면 설정하기' }).click();
  for (const id of amounts) await expect(page.getByTestId(id)).toHaveText('52,400원');
  await expect(page.getByTestId('home-widget').getByText('님 부자임?')).toBeVisible();
  await expect(page.getByTestId('lock-widget').getByText('님 부자임?')).toBeVisible();
});

test('a failed read shows the widget fallback instead of a zero', async ({ page }) => {
  await page.goto('/display?scenario=readFailure');
  await expect(page.getByRole('alert')).toContainText('기록을 불러오지 못했어요');
  for (const id of amounts) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByTestId('widget-fallback').getByText('앱에서 기록 확인')).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
});

test('before onboarding is finished the widget asks to start in the app', async ({ page }) => {
  await page.goto('/display?scenario=firstStart');
  await expect(page.getByTestId('widget-fallback').getByText('AYR에서 시작하기')).toBeVisible();
  for (const id of amounts) await expect(page.getByTestId(id)).toHaveCount(0);
});
