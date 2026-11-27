import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const pick = (page: Page, label: string) => page.getByLabel('미리보기 시나리오').selectOption({ label });
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test('the preview label is always visible, on every screen and over the recovery screen', async ({ page }) => {
  await page.goto('/');
  const label = page.getByText('미리보기 · 가짜 기록');
  await expect(label).toBeVisible();
  await page.getByRole('tab', { name: '월별' }).click();
  await expect(label).toBeVisible();
  await page.getByRole('tab', { name: '설정' }).click();
  await page.getByRole('link', { name: '잠금화면 설정하기' }).click();
  await expect(label).toBeVisible();
  await page.goto('/?scenario=corrupt');
  await expect(page.getByRole('heading', { name: '기록을 불러오지 못했어요' })).toBeVisible();
  await expect(label).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
});

test('the scenario list opens the existing fake scenarios', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('미리보기 시나리오')).toHaveValue('default');
  await pick(page, '빈 기록');
  await expect(page.getByTestId('today-total')).toHaveText('0원');
  await expect(page.getByLabel('미리보기 시나리오')).toHaveValue('empty');
  await pick(page, '처음 시작');
  await expect(page.getByRole('heading', { name: '내 소비의 기준부터.' })).toBeVisible();
  await pick(page, '수신 실패');
  await expect(page.getByText('지원하는 결제 문자가 아니어서 지출에 더하지 않았어요.')).toBeVisible();
  await expect(page.getByTestId('today-total')).toHaveText('32,400원');
  await pick(page, '손상 기록');
  await expect(page.getByRole('heading', { name: '기록을 불러오지 못했어요' })).toBeVisible();
  await pick(page, '기본');
  await expect(page.getByTestId('today-total')).toHaveText('32,400원');
  expect(await noOverflow(page)).toBe(true);
});

test('save failure and date change scenarios are selectable', async ({ page }) => {
  await page.goto('/');
  await pick(page, '저장 실패');
  await expect(page).toHaveURL(/scenario=saveFailureOnce/);
  await pick(page, '날짜 변경');
  await expect(page).toHaveURL(/scenario=dayChange/);
  await expect(page.getByTestId('today-total')).toHaveText('32,400원');
});

test('restart goes back to the fake starting values', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '오늘의 범행 기록 보기' }).click();
  await page.getByRole('button', { name: '지출 추가' }).click();
  await page.getByLabel('금액(원)').fill('5100');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByTestId('spending-total')).toHaveText('37,500원');
  await page.getByRole('button', { name: '다시 시작' }).click();
  await expect(page.getByTestId('today-total')).toHaveText('32,400원');
});

test('the tools state that the records are fake and nothing is kept in the browser', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('실제 장부와 연결되지 않아요. 새로고침하면 처음 가짜 값으로 돌아가요.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
});
