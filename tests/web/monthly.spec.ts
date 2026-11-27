import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const openMonthly = async (page: Page, scenario = 'default') => {
  await page.goto(`/?scenario=${scenario}`);
  await page.getByRole('tab', { name: '월별' }).click();
  await expect(page.getByTestId('month-title')).toBeVisible();
};
const previous = (page: Page) => page.getByRole('button', { name: '이전 달' });
const following = (page: Page) => page.getByRole('button', { name: '다음 달' });
const day = (page: Page, key: string) => page.getByTestId(`day-${key}`);

test('the month shows total, budget, remaining, comparison, calendar and phrase days that add up', async ({ page }) => {
  await openMonthly(page);
  await expect(page.getByTestId('month-title')).toHaveText('2026년 11월');
  await expect(page.getByTestId('month-total')).toHaveText('286,400원');
  await expect(page.getByTestId('month-budget')).toHaveText('예산 1,500,000원');
  await expect(page.getByTestId('month-remaining')).toHaveText('1,213,600원 남았어요');
  await expect(page.getByTestId('month-comparison')).toHaveText('지난달 같은 기간보다 44,400원 더 썼어요.');
  await expect(page.getByTestId('phrase-calm')).toContainText('5일');
  await expect(page.getByTestId('phrase-caution')).toContainText('5일');
  await expect(page.getByTestId('phrase-exceeded')).toContainText('1일');
  // Today's cell equals the Today tab, a recorded zero is 0원, and a day that has not come is not a zero.
  await expect(day(page, '2026-11-11')).toHaveAttribute('aria-label', '2026년 11월 11일, 32,400원, 오늘 좀 쓰는데?');
  await expect(day(page, '2026-11-02')).toHaveAttribute('aria-label', '2026년 11월 2일, 0원, 아직은 여유 있네');
  await expect(day(page, '2026-11-05')).toHaveAttribute('aria-label', '2026년 11월 5일, 50,000원, 님 부자임?');
  await expect(day(page, '2026-11-12')).toHaveAttribute('aria-label', '2026년 11월 12일, 아직 오지 않은 날');
  expect(await noOverflow(page)).toBe(true);
  await page.getByRole('tab', { name: '오늘' }).click();
  await expect(page.getByTestId('today-total')).toHaveText('32,400원');
});

test('previous and next stop at the oldest kept month and at this month', async ({ page }) => {
  await openMonthly(page);
  await expect(following(page)).toBeDisabled();
  await previous(page).click();
  await expect(page.getByTestId('month-title')).toHaveText('2026년 10월');
  await expect(page.getByTestId('month-total')).toHaveText('752,000원');
  await expect(page.getByTestId('month-remaining')).toHaveText('748,000원 남았어요');
  // September is only partly recorded, so there is no basis to compare and the screen says so instead of showing a difference.
  await expect(page.getByTestId('month-comparison')).toHaveText('비교할 지난달 기록이 아직 없어요.');
  await expect(following(page)).toBeEnabled();
  for (let count = 0; count < 10; count++) await previous(page).click();
  await expect(page.getByTestId('month-title')).toHaveText('2025년 12월');
  await expect(previous(page)).toBeDisabled();
  await expect(day(page, '2025-12-01')).toHaveAttribute('aria-label', '2025년 12월 1일, 기록 없음');
  await expect(page.getByTestId('month-total')).toHaveText('0원');
  for (let count = 0; count < 11; count++) await following(page).click();
  await expect(page.getByTestId('month-title')).toHaveText('2026년 11월');
  await expect(following(page)).toBeDisabled();
});

test('moving quickly through months ends on the last chosen month with its own numbers', async ({ page }) => {
  await openMonthly(page);
  await previous(page).click();
  await previous(page).click();
  await previous(page).click();
  await following(page).click();
  await expect(page.getByTestId('month-title')).toHaveText('2026년 9월');
  await expect(day(page, '2026-09-15')).toHaveAttribute('aria-label', '2026년 9월 15일, 기록 없음');
  await expect(day(page, '2026-09-16')).toHaveAttribute('aria-label', /2026년 9월 16일, [0-9,]+원/);
  await expect(page.getByTestId('month-comparison')).toHaveText('비교할 지난달 기록이 아직 없어요.');
});

test('adding and deleting a spending changes the month total together with today', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '오늘의 범행 기록 보기' }).click();
  await page.getByRole('button', { name: '지출 추가' }).click();
  await page.getByLabel('금액(원)').fill('5100');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByTestId('spending-total')).toHaveText('37,500원');
  await page.getByRole('button', { name: '뒤로' }).click();
  await page.getByRole('tab', { name: '월별' }).click();
  await expect(page.getByTestId('month-total')).toHaveText('291,500원');
  await expect(day(page, '2026-11-11')).toHaveAttribute('aria-label', '2026년 11월 11일, 37,500원, 오늘 좀 쓰는데?');
  await expect(page.getByTestId('month-comparison')).toHaveText('지난달 같은 기간보다 49,500원 더 썼어요.');
  await page.getByRole('tab', { name: '오늘' }).click();
  await expect(page.getByTestId('today-total')).toHaveText('37,500원');
  await page.getByRole('link', { name: '오늘의 범행 기록 보기' }).click();
  await page.getByRole('button', { name: '4번째 지출 5,100원 삭제' }).click();
  await page.getByRole('button', { name: '5,100원 삭제', exact: true }).click();
  await expect(page.getByTestId('spending-total')).toHaveText('32,400원');
  await page.getByRole('button', { name: '뒤로' }).click();
  await page.getByRole('tab', { name: '월별' }).click();
  await expect(page.getByTestId('month-total')).toHaveText('286,400원');
});

test('changing the monthly budget reuses the settings editor and keeps last month budget', async ({ page }) => {
  await openMonthly(page);
  await page.getByRole('button', { name: '이번 달 예산 바꾸기' }).click();
  await expect(page.getByRole('heading', { name: '내 기준 바꾸기' })).toBeVisible();
  await page.getByLabel('월 예산(원)').fill('200000');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByTestId('month-title')).toBeVisible();
  await expect(page.getByTestId('month-budget')).toHaveText('예산 200,000원');
  await expect(page.getByTestId('month-remaining')).toHaveText('86,400원 초과');
  await previous(page).click();
  await expect(page.getByTestId('month-budget')).toHaveText('예산 1,500,000원');
});

test('a month that cannot be read is an error with a retry, never an empty month', async ({ page }) => {
  await openMonthly(page, 'monthReadFailureOnce');
  await expect(page.getByRole('alert')).toContainText('기록을 불러오지 못했어요');
  await expect(page.getByTestId('month-total')).toHaveCount(0);
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByTestId('month-total')).toHaveText('286,400원');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('an empty configured ledger shows today as a recorded zero and earlier days as no record', async ({ page }) => {
  await page.goto('/?scenario=empty');
  await page.getByRole('tab', { name: '월별' }).click();
  await expect(page.getByTestId('month-total')).toHaveText('0원');
  await expect(day(page, '2026-11-11')).toHaveAttribute('aria-label', '2026년 11월 11일, 0원, 아직은 여유 있네');
  await expect(day(page, '2026-11-10')).toHaveAttribute('aria-label', '2026년 11월 10일, 기록 없음');
  await expect(page.getByTestId('month-comparison')).toHaveText('비교할 지난달 기록이 아직 없어요.');
});

test('the largest amounts keep every digit and never overflow the screen', async ({ page }) => {
  await openMonthly(page, 'maximum');
  const total = page.getByTestId('month-total');
  await expect(total).toHaveText('25,200,470,046,051,300원');
  expect(await total.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.getByTestId('month-remaining')).toHaveText('25,200,470,044,551,300원 초과');
  await expect(day(page, '2026-11-11')).toHaveAttribute('aria-label', '2026년 11월 11일, 25,200,470,046,051,300원, 님 부자임?');
  expect(await day(page, '2026-11-11').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(await noOverflow(page)).toBe(true);
});
