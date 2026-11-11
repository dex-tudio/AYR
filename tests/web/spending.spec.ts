import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const openSpending = async (page: Page, scenario = 'default') => {
  await page.goto(`/?scenario=${scenario}`);
  await page.getByRole('link', { name: '오늘 지출 보기 · 추가 · 삭제' }).click();
  await expect(page.getByRole('heading', { name: '오늘 지출' })).toBeVisible();
};
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const addButton = (page: Page) => page.getByRole('button', { name: '추가', exact: true });

test('list shows the fake day, adding 5,100 makes 37,500 and the form closes only after saving', async ({ page }) => {
  await openSpending(page);
  await expect(page.getByTestId('spending-total')).toHaveText('32,400원');
  await expect(page.getByText('새로 기록된 지출 3건')).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  await page.getByRole('button', { name: '지출 추가' }).click();
  await expect(page.getByRole('heading', { name: '지출 추가' })).toBeVisible();
  await expect(addButton(page)).toBeDisabled();
  await page.getByLabel('금액(원)').fill('5100');
  await expect(page.getByTestId('add-preview')).toHaveText('5,100원을 더해요');
  expect(await noOverflow(page)).toBe(true);
  await addButton(page).click();
  await expect(page.getByRole('heading', { name: '오늘 지출' })).toBeVisible();
  await expect(page.getByTestId('spending-total')).toHaveText('37,500원');
  await expect(page.getByText('새로 기록된 지출 4건')).toBeVisible();
});

test('invalid amounts keep the add button disabled', async ({ page }) => {
  await openSpending(page);
  await page.getByRole('button', { name: '지출 추가' }).click();
  for (const bad of ['0', 'abc', '1.5', '-3', '25200470046051301']) {
    await page.getByLabel('금액(원)').fill(bad);
    await expect(addButton(page)).toBeDisabled();
    await expect(page.getByTestId('add-preview')).toHaveCount(0);
  }
  await page.getByLabel('금액(원)').fill('25200470046051300');
  await expect(addButton(page)).toBeEnabled();
});

test('deleting removes only the chosen entry even when two amounts are equal', async ({ page }) => {
  await openSpending(page);
  await page.getByRole('button', { name: '지출 추가' }).click();
  await page.getByLabel('금액(원)').fill('5100');
  await addButton(page).click();
  await page.getByRole('button', { name: '1번째 지출 5,100원 삭제' }).click();
  await expect(page.getByText('이 지출을 삭제할까요?')).toBeVisible();
  await page.getByRole('button', { name: '5,100원 삭제', exact: true }).click();
  await expect(page.getByText('이 지출을 삭제할까요?')).toHaveCount(0);
  await expect(page.getByTestId('spending-total')).toHaveText('32,400원');
  await expect(page.getByTestId('spending-row-0')).toContainText('8,700원');
  await expect(page.getByTestId('spending-row-1')).toContainText('18,600원');
  await expect(page.getByTestId('spending-row-2')).toContainText('5,100원');
  expect(await noOverflow(page)).toBe(true);
});

test('cancel leaves the list untouched', async ({ page }) => {
  await openSpending(page);
  await page.getByRole('button', { name: '2번째 지출 8,700원 삭제' }).click();
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByText('이 지출을 삭제할까요?')).toHaveCount(0);
  await expect(page.getByTestId('spending-total')).toHaveText('32,400원');
});

test('the carried total is shown apart, cannot be deleted, and survives removing the last new entry', async ({ page }) => {
  await openSpending(page, 'carried');
  await expect(page.getByText('이전 합계 12,000원')).toBeVisible();
  await expect(page.getByTestId('spending-total')).toHaveText('15,000원');
  await expect(page.getByRole('button', { name: /번째 지출 .* 삭제/ })).toHaveCount(1);
  await page.getByRole('button', { name: '1번째 지출 3,000원 삭제' }).click();
  await page.getByRole('button', { name: '3,000원 삭제', exact: true }).click();
  await expect(page.getByTestId('spending-total')).toHaveText('12,000원');
  await expect(page.getByText('이전 합계 12,000원')).toBeVisible();
  await expect(page.getByText('새로 기록된 지출이 없어요.')).toBeVisible();
  await expect(page.getByRole('button', { name: /번째 지출 .* 삭제/ })).toHaveCount(0);
});

test('after midnight the old form is rejected, the typed amount stays, and the user can confirm the new day', async ({ page }) => {
  await openSpending(page, 'dayChange');
  await page.getByRole('button', { name: '지출 추가' }).click();
  await page.getByLabel('금액(원)').fill('1000');
  await addButton(page).click();
  await expect(page.getByRole('heading', { name: '저장하지 못했어요' })).toBeVisible();
  await expect(page.getByText('날짜가 바뀌었어요. 오늘 기록을 확인한 뒤 다시 시도해주세요.')).toBeVisible();
  await expect(page.getByRole('heading', { name: '날짜가 바뀌었어요' })).toBeVisible();
  await expect(page.getByLabel('금액(원)')).toHaveValue('1000');
  await expect(addButton(page)).toBeDisabled();
  await page.getByRole('button', { name: '오늘 날짜로 바꾸기' }).click();
  await expect(page.getByRole('heading', { name: '날짜가 바뀌었어요' })).toHaveCount(0);
  await expect(page.getByLabel('금액(원)')).toHaveValue('1000');
  await addButton(page).click();
  await expect(page.getByRole('heading', { name: '오늘 지출' })).toBeVisible();
  await expect(page.getByTestId('spending-total')).toHaveText('1,000원');
});

test('a reception during delete confirmation rejects the stale choice and asks to choose again', async ({ page }) => {
  await openSpending(page, 'listChange');
  await page.getByRole('button', { name: '1번째 지출 5,100원 삭제' }).click();
  await page.getByRole('button', { name: '5,100원 삭제', exact: true }).click();
  await expect(page.getByText('지출 목록이 바뀌었어요. 최신 기록을 확인한 뒤 다시 선택해주세요.')).toBeVisible();
  await expect(page.getByText('이 지출을 삭제할까요?')).toHaveCount(0);
  await expect(page.getByTestId('spending-total')).toHaveText('33,600원');
  await expect(page.getByText('새로 기록된 지출 4건')).toBeVisible();
  await page.getByRole('button', { name: '1번째 지출 5,100원 삭제' }).click();
  await page.getByRole('button', { name: '5,100원 삭제', exact: true }).click();
  await expect(page.getByTestId('spending-total')).toHaveText('28,500원');
  await expect(page.getByText('반영하지 못했어요')).toHaveCount(0);
});

test('a failed save keeps the input, shows the failure, and one retry saves once', async ({ page }) => {
  await openSpending(page, 'saveFailureOnce');
  await page.getByRole('button', { name: '지출 추가' }).click();
  await page.getByLabel('금액(원)').fill('1000');
  await addButton(page).click();
  await expect(page.getByText('저장하지 못했어요. 잠시 뒤 다시 시도해주세요.')).toBeVisible();
  await expect(page.getByRole('heading', { name: '지출 추가' })).toBeVisible();
  await expect(page.getByLabel('금액(원)')).toHaveValue('1000');
  await addButton(page).click();
  await expect(page.getByRole('heading', { name: '오늘 지출' })).toBeVisible();
  await expect(page.getByTestId('spending-total')).toHaveText('33,400원');
  await expect(page.getByText('새로 기록된 지출 4건')).toBeVisible();
  await expect(page.getByText('반영하지 못했어요')).toHaveCount(0);
});

test('two presses in the same instant change the ledger once', async ({ page }) => {
  await openSpending(page);
  await page.getByRole('button', { name: '지출 추가' }).click();
  await page.getByLabel('금액(원)').fill('1000');
  await addButton(page).evaluate((element: HTMLElement) => { element.click(); element.click(); });
  await expect(page.getByRole('heading', { name: '오늘 지출' })).toBeVisible();
  await expect(page.getByTestId('spending-total')).toHaveText('33,400원');
  await expect(page.getByText('새로 기록된 지출 4건')).toBeVisible();
  await page.getByRole('button', { name: '4번째 지출 1,000원 삭제' }).click();
  await page.getByRole('button', { name: '1,000원 삭제', exact: true }).evaluate((element: HTMLElement) => { element.click(); element.click(); });
  await expect(page.getByTestId('spending-total')).toHaveText('32,400원');
  await expect(page.getByText('새로 기록된 지출 3건')).toBeVisible();
  await expect(page.getByText('반영하지 못했어요')).toHaveCount(0);
});

test('a press right after the save succeeded does not save the same spending again', async ({ page }) => {
  await openSpending(page);
  await page.getByRole('button', { name: '지출 추가' }).click();
  await page.getByLabel('금액(원)').fill('1000');
  // The second press arrives after the save finished but before the form is gone.
  await addButton(page).evaluate(async (element: HTMLElement) => {
    element.click();
    for (let turn = 0; turn < 3; turn++) await new Promise(resolve => setTimeout(resolve, 0));
    element.click();
  });
  await expect(page.getByRole('heading', { name: '오늘 지출' })).toBeVisible();
  await expect(page.getByTestId('spending-total')).toHaveText('33,400원');
  await expect(page.getByText('새로 기록된 지출 4건')).toBeVisible();
});

test('first start cannot add spending', async ({ page }) => {
  await page.goto('/?scenario=firstStart');
  await expect(page.getByText('시작 설정을 먼저 마쳐주세요')).toBeVisible();
  await expect(page.getByRole('link', { name: '오늘 지출 보기 · 추가 · 삭제' })).toHaveCount(0);
});
