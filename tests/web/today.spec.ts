import { test, expect } from '@playwright/test';

test('today shows fake amount, phrase and identity with no horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('미리보기 · 가짜 기록')).toBeVisible();
  await expect(page.getByTestId('today-total')).toHaveText('32,400원');
  await expect(page.getByText('오늘 좀 쓰는데?')).toBeVisible();
  await expect(page.getByText('직장인 · 하루 기준 50,000원')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('read error does not display a zero balance and can retry', async ({ page }) => {
  await page.goto('/?scenario=readFailure');
  await expect(page.getByRole('alert')).toContainText('기록을 불러오지 못했어요');
  await expect(page.getByTestId('today-total')).toHaveCount(0);
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('ayr-preview-connected')).toHaveCount(0);
});
test('retry after a failed read reads again and recovers', async ({ page }) => {
  await page.goto('/?scenario=readFailureOnce');
  await expect(page.getByRole('alert')).toContainText('기록을 불러오지 못했어요');
  await expect(page.getByTestId('ayr-preview-connected')).toHaveCount(0);
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByTestId('today-total')).toHaveText('32,400원');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTestId('ayr-preview-connected')).toBeVisible();
});
test('first start is distinct from configured empty records', async ({ page }) => {
  await page.goto('/?scenario=firstStart');
  // A ledger that has not finished onboarding is sent to the onboarding flow instead of showing a zero.
  await expect(page.getByRole('heading', { name: '내 소비의 기준부터.' })).toBeVisible();
  // The native smoke relies on this marker for a fresh ledger that has not finished onboarding.
  await expect(page.getByTestId('ayr-preview-connected')).toBeVisible();
  await expect(page.getByTestId('today-total')).toHaveCount(0);
  await page.goto('/?scenario=empty');
  await expect(page.getByTestId('today-total')).toHaveText('0원');
});
test('maximum money keeps every digit and the won unit visible', async ({ page }) => {
  await page.goto('/?scenario=maximum');
  const amount = page.getByTestId('today-total');
  await expect(amount).toHaveText('25,200,470,046,051,300원');
  expect(await amount.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const box = await amount.boundingBox();
  const viewportWidth = page.viewportSize()!.width;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('tab labels sit fully inside their tab at every viewport', async ({ page }) => {
  await page.goto('/');
  for (const name of ['오늘', '월별', '설정']) {
    const tab = await page.getByRole('tab', { name }).boundingBox();
    const text = page.getByRole('tab', { name }).getByText(name, { exact: true });
    const label = await text.boundingBox();
    // An empty icon box once squeezed the label below its own font size and pushed it to the bottom of the bar.
    const fontSize = await text.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
    expect(label!.height).toBeGreaterThanOrEqual(fontSize);
    expect(label!.y).toBeGreaterThanOrEqual(tab!.y);
    expect(label!.y + label!.height).toBeLessThanOrEqual(tab!.y + tab!.height);
  }
});
