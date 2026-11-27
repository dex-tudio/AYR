import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const next = (page: Page) => page.getByRole('button', { name: '다음', exact: true });
const budget = (page: Page) => page.getByLabel('하루 기준 금액(원)');
const kb = (page: Page) => page.getByRole('checkbox', { name: 'KB국민 체크카드 · 문자' });
// Inactive tabs stay mounted but hidden; getByText also sees them, so text checks on tab content ask for the visible one.
const shown = (page: Page, text: string) => page.getByText(text).filter({ visible: true });
const step = (page: Page, title: string) => expect(page.getByRole('heading', { name: title })).toBeVisible();
const titles = ['내 소비의 기준부터.', '어떻게 결제하나요?', '잠금화면에서 만나요.', '문자가 오면, 자동으로.', '이제 연결을 확인해요.'];
// expo-clipboard falls back to execCommand when writeText fails and only reports failure if that throws, so the failing stub blocks both.
const stubClipboard = (page: Page, works: boolean) => page.addInitScript(ok => {
  if (!ok) document.execCommand = () => { throw new Error('blocked'); };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: (text: string) => { (window as unknown as { copied: string }).copied = text; return ok ? Promise.resolve() : Promise.reject(new Error('denied')); },
  } });
}, works);
const openSettings = async (page: Page, scenario = 'default') => {
  await page.goto(`/?scenario=${scenario}`);
  await page.getByRole('tab', { name: '설정' }).click();
  await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible();
};

for (const [path, text] of [['/connection', 'KB국민체크'], ['/connection-check', 'KB국민체크 AYR테스트']]) {
  test(`dark connection text stays readable on its card: ${path}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(path);
    const phrase = page.getByText(text, { exact: true });
    await expect(phrase).toBeVisible();
    const colors = await phrase.evaluate(element => {
      const color = getComputedStyle(element).color;
      let background = 'rgba(0, 0, 0, 0)';
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        background = getComputedStyle(parent).backgroundColor;
        if (background !== 'rgba(0, 0, 0, 0)') break;
      }
      const luminance = (rgb: string) => rgb.match(/\d+/g)!.slice(0, 3).map(Number).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const ink = luminance(color), surface = luminance(background);
      return { color, background, contrast: (Math.max(ink, surface) + 0.05) / (Math.min(ink, surface) + 0.05) };
    });
    expect(colors.background).toBe('rgb(35, 32, 46)');
    expect(colors.color).toBe('rgb(244, 242, 250)');
    expect(colors.contrast).toBeGreaterThanOrEqual(4.5);
  });
}

test('a first start goes to onboarding and walks five steps with back and forward', async ({ page }) => {
  await page.goto('/?scenario=firstStart');
  await step(page, titles[0]);
  await expect(page.getByTestId('ayr-preview-connected')).toBeVisible();
  await expect(page.getByText('시작하기 1/5')).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  await next(page).click();
  await step(page, titles[1]);
  expect(await noOverflow(page)).toBe(true);
  await next(page).click();
  await step(page, titles[2]);
  await expect(page.getByText('iPhone에서 가능한 기능이에요')).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  await next(page).click();
  await step(page, titles[3]);
  expect(await noOverflow(page)).toBe(true);
  await next(page).click();
  await step(page, titles[4]);
  await expect(page.getByText('시작하기 5/5')).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  await page.getByRole('button', { name: '이전' }).click();
  await step(page, titles[3]);
  await page.getByRole('button', { name: '이전' }).click();
  await page.getByRole('button', { name: '이전' }).click();
  await page.getByRole('button', { name: '이전' }).click();
  await step(page, titles[0]);
  await expect(page.getByRole('button', { name: '이전' })).toHaveCount(0);
});

test('a new identity brings its default budget, and invalid budgets block the next step', async ({ page }) => {
  await page.goto('/?scenario=firstStart');
  await expect(budget(page)).toHaveValue('50000');
  await page.getByRole('radio', { name: '학생' }).click();
  await expect(budget(page)).toHaveValue('20000');
  await page.getByRole('radio', { name: '취준생' }).click();
  await expect(budget(page)).toHaveValue('30000');
  for (const bad of ['0', '', 'abc', '1.5', '-3', '25200470046051301']) {
    await budget(page).fill(bad);
    await expect(next(page)).toBeDisabled();
    await expect(page.getByText('하루 기준은 1~25,200,470,046,051,300원 사이의 숫자로 적어주세요.')).toBeVisible();
  }
  await budget(page).fill('25200470046051300');
  await expect(next(page)).toBeEnabled();
  await budget(page).fill('45000');
  await next(page).click();
  await step(page, titles[1]);
  await page.getByRole('button', { name: '이전' }).click();
  await expect(budget(page)).toHaveValue('45000');
  await expect(page.getByRole('radio', { name: '취준생' })).toBeChecked();
});

test('only the supported source can be chosen and an empty choice blocks the step', async ({ page }) => {
  await page.goto('/?scenario=firstStart');
  await next(page).click();
  await expect(kb(page)).toBeChecked();
  const toss = page.getByRole('checkbox', { name: /토스뱅크/ });
  await expect(toss).toBeDisabled();
  await expect(page.getByText('준비 중', { exact: true })).toBeVisible();
  await toss.click({ force: true });
  await expect(toss).not.toBeChecked();
  await kb(page).click();
  await expect(next(page)).toBeDisabled();
  await expect(page.getByText('연결할 결제 수단을 하나 골라주세요.')).toBeVisible();
  await kb(page).click();
  await expect(next(page)).toBeEnabled();
});

test('a failed save keeps the step, shows the failure, and the retry moves on once', async ({ page }) => {
  await page.goto('/?scenario=firstStartSaveFailureOnce');
  await next(page).click();
  await expect(page.getByRole('alert')).toContainText('저장하지 못했어요. 잠시 뒤 다시 시도해주세요.');
  await step(page, titles[0]);
  await next(page).click();
  await step(page, titles[1]);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('the automation guide copies the connection phrase and tells when copying fails', async ({ page }) => {
  await stubClipboard(page, true);
  await page.goto('/?scenario=firstStart');
  for (let index = 0; index < 3; index += 1) await next(page).click();
  await step(page, titles[3]);
  await expect(page.getByText('KB국민체크', { exact: true })).toBeVisible();
  await expect(page.getByText('iPhone에서 단축어 앱이 열려요')).toBeVisible();
  await page.getByRole('button', { name: 'KB국민 체크카드 · 문자 연결 문구 복사' }).click();
  await expect(page.getByText('복사했어요.')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe('KB국민체크');
});

test('a clipboard failure is reported instead of shown as copied', async ({ page }) => {
  await stubClipboard(page, false);
  await page.goto('/?scenario=firstStart');
  for (let index = 0; index < 3; index += 1) await next(page).click();
  await page.getByRole('button', { name: 'KB국민 체크카드 · 문자 연결 문구 복사' }).click();
  await expect(page.getByText('복사하지 못했어요. 문구를 길게 눌러 직접 복사해주세요.')).toBeVisible();
  await expect(page.getByText('복사했어요.')).toHaveCount(0);
});

// The settings → connection route is covered in app-flow; opening the check directly avoids clicking a link the hidden Today tab also has.
test('a test text is shown as the last call but never added', async ({ page }) => {
  await stubClipboard(page, true);
  await page.goto('/connection-check?scenario=empty');
  await expect(page.getByText('KB국민체크 AYR테스트', { exact: true })).toBeVisible();
  await expect(shown(page, '아직 도착한 결제 문자가 없어요')).toBeVisible();
  await page.getByRole('button', { name: 'KB국민 체크카드 · 문자 확인용 문구 복사' }).click();
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe('KB국민체크 AYR테스트');
  await page.getByRole('button', { name: '미리보기: 확인용 문자 도착 시뮬레이션' }).click();
  await expect(shown(page, '확인용 문자가 도착했어요. 지출에는 더하지 않았어요.')).toBeVisible();
  await expect(page.getByText('미리보기 시뮬레이션이에요. 실제 문자 자동화 결과가 아니에요.')).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  await page.getByRole('button', { name: '뒤로' }).click();
  await page.getByRole('tab', { name: '오늘' }).click();
  await expect(page.getByTestId('today-total')).toHaveText('0원');
  await expect(shown(page, '확인용 문자가 도착했어요. 지출에는 더하지 않았어요.')).toBeVisible();
});

test('finishing onboarding without any reception shows no connection success', async ({ page }) => {
  await page.goto('/?scenario=firstStart');
  for (let index = 0; index < 4; index += 1) await next(page).click();
  await step(page, titles[4]);
  await expect(shown(page, '아직 도착한 결제 문자가 없어요')).toBeVisible();
  await expect(page.getByText('연결 확인은 나중에 해도 돼요.')).toBeVisible();
  await page.getByRole('button', { name: '시작하기', exact: true }).click();
  await expect(page.getByTestId('today-total')).toBeVisible();
  await expect(shown(page, '아직 도착한 결제 문자가 없어요')).toBeVisible();
  await expect(page.getByText('확인용 문자가 도착했어요')).toHaveCount(0);
  await expect(page.getByText('오늘 쓴 돈에 더했어요')).toHaveCount(0);
});

test('settings show the values and editing changes identity, budget and monthly budget', async ({ page }) => {
  await openSettings(page);
  await expect(page.getByText('직장인', { exact: true })).toBeVisible();
  await expect(page.getByText('50,000원', { exact: true })).toBeVisible();
  await expect(page.getByText('1,500,000원', { exact: true })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  await page.getByRole('button', { name: '내 기준 바꾸기' }).click();
  await expect(page.getByRole('heading', { name: '내 기준 바꾸기' })).toBeVisible();
  await page.getByRole('radio', { name: '취준생' }).click();
  await expect(budget(page)).toHaveValue('30000');
  await page.getByRole('switch', { name: '월 예산 직접 입력' }).click();
  await expect(page.getByLabel('월 예산(원)')).toHaveCount(0);
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible();
  await expect(page.getByText('취준생', { exact: true })).toBeVisible();
  await expect(page.getByText('30,000원', { exact: true })).toBeVisible();
  await expect(page.getByText('하루 기준 × 그 달 일수', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '오늘' }).click();
  await expect(page.getByText('취준생 · 하루 기준 30,000원')).toBeVisible();
  await expect(page.getByTestId('today-total')).toHaveText('32,400원');
});

test('editing rejects bad budgets and cancel changes nothing', async ({ page }) => {
  await openSettings(page);
  await page.getByRole('button', { name: '내 기준 바꾸기' }).click();
  const save = page.getByRole('button', { name: '저장', exact: true });
  for (const bad of ['0', '', 'abc', '25200470046051301']) {
    await budget(page).fill(bad);
    await expect(save).toBeDisabled();
  }
  await budget(page).fill('50000');
  await page.getByLabel('월 예산(원)').fill('0');
  await expect(save).toBeDisabled();
  await page.getByLabel('월 예산(원)').fill('1000000');
  await expect(save).toBeEnabled();
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible();
  await expect(page.getByText('1,500,000원', { exact: true })).toBeVisible();
});

test('a failed settings save keeps the form open and one retry saves', async ({ page }) => {
  await openSettings(page, 'saveFailureOnce');
  await page.getByRole('button', { name: '내 기준 바꾸기' }).click();
  await page.getByRole('radio', { name: '학생' }).click();
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('저장하지 못했어요. 잠시 뒤 다시 시도해주세요.');
  await expect(page.getByRole('heading', { name: '내 기준 바꾸기' })).toBeVisible();
  await expect(budget(page)).toHaveValue('20000');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible();
  await expect(page.getByText('학생', { exact: true })).toBeVisible();
});

test('the display guide marks iPhone-only features as a design preview on the web', async ({ page }) => {
  await openSettings(page);
  await page.getByRole('link', { name: '잠금화면 설정하기' }).click();
  await expect(page.getByRole('heading', { name: '잠금화면 표시' })).toBeVisible();
  await expect(page.getByText('iPhone에서 가능한 기능이에요')).toBeVisible();
  await expect(page.getByText('1. 잠금화면을 길게 누르고 사용자화를 선택하세요.')).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
});

test('recovery is not offered when the record is fine or only a read failed', async ({ page }) => {
  for (const scenario of ['default', 'readFailure']) {
    await page.goto(`/?scenario=${scenario}`);
    await expect(page.getByText('오늘', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('원본 보관 후 새로 시작')).toHaveCount(0);
  }
  await openSettings(page);
  await expect(page.getByText('원본 보관 후 새로 시작')).toHaveCount(0);
});

test('a damaged record offers recovery; cancel changes nothing and confirm starts onboarding', async ({ page }) => {
  await page.goto('/?scenario=corrupt');
  await expect(page.getByRole('alert')).toContainText('저장된 기록이 손상됐어요');
  await expect(page.getByTestId('ayr-preview-connected')).toHaveCount(0);
  expect(await noOverflow(page)).toBe(true);
  const open = page.getByRole('button', { name: '원본 보관 후 새로 시작' });
  await open.click();
  await expect(page.getByRole('heading', { name: '기록을 새로 시작할까요?' })).toBeVisible();
  await expect(page.getByText('지금 기록은 앱에서 더 이상 볼 수 없어요. 원본은 기기 안에 따로 보관하고, 처음 설정부터 다시 시작해요.')).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('heading', { name: '기록을 새로 시작할까요?' })).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('저장된 기록이 손상됐어요');
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByRole('alert')).toContainText('저장된 기록이 손상됐어요');
  await open.click();
  await page.getByRole('button', { name: '원본 보관 후 새로 시작' }).click();
  await step(page, titles[0]);
  await expect(page.getByText('저장된 기록이 손상됐어요')).toHaveCount(0);
  await expect(page.getByTestId('ayr-preview-connected')).toBeVisible();
});

test('a failed recovery keeps the damaged state and can be retried', async ({ page }) => {
  await page.goto('/?scenario=corruptResetFailureOnce');
  await page.getByRole('button', { name: '원본 보관 후 새로 시작' }).click();
  await page.getByRole('button', { name: '원본 보관 후 새로 시작' }).click();
  await expect(page.getByText('원본을 따로 보관하지 못해 새로 시작하지 않았어요. 기존 기록은 그대로 두었어요.')).toBeVisible();
  await expect(page.getByRole('heading', { name: '기록을 새로 시작할까요?' })).toHaveCount(0);
  await expect(page.getByText('내 소비의 기준부터.')).toHaveCount(0);
  await page.getByRole('button', { name: '원본 보관 후 새로 시작' }).click();
  await page.getByRole('button', { name: '원본 보관 후 새로 시작' }).click();
  await step(page, titles[0]);
});

test('a saved list that holds an unsupported source can still be edited and saved', async ({ page }) => {
  await openSettings(page, 'mixedSources');
  await page.getByRole('button', { name: '내 기준 바꾸기' }).click();
  await expect(kb(page)).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /토스뱅크/ })).not.toBeChecked();
  const save = page.getByRole('button', { name: '저장', exact: true });
  await expect(save).toBeEnabled();
  await page.getByRole('radio', { name: '학생' }).click();
  await save.click();
  await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible();
  await expect(page.getByText('학생', { exact: true })).toBeVisible();
});

test('a screen with a failed read shows the error with a retry and then its content', async ({ page }) => {
  await page.goto('/connection?scenario=readFailureOnce');
  await expect(page.getByRole('heading', { name: '결제 문자 연결' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('기록을 불러오지 못했어요');
  await expect(page.getByRole('link', { name: '연결 확인하기' })).toHaveCount(0);
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '연결 확인하기' })).toBeVisible();
});
