import Foundation
import AYRCore

func check(_ condition: @autoclosure () -> Bool, line: UInt = #line) { precondition(condition(), "check failed at line \(line)") }
let large = 9_007_199_254_740_993
let date = ISO8601DateFormatter().date(from: "2026-11-11T12:00:00Z")!
var ledger = SpendingLedger(now: date)
try ledger.updateSettings(AppSettings(identity: .worker, dailyBudget: maximumMoney)!, monthlyBudget: nil, now: date)
ledger.completeOnboarding(now: date)
try ledger.addSpending(large, expectedDay: ledger.current.day, now: date)
let snapshot = try LedgerBridgeState.snapshot(ledger: ledger)
let current = (snapshot["ledger"] as! [String: Any])["current"] as! [String: Any]
check(current["total"] as? String == "9007199254740993")
check(current["budget"] as? String == String(maximumMoney))
check((snapshot["metadata"] as! [String: Any])["maximumMoney"] as? String == String(maximumMoney))
for invalid in ["0", "-1", "1.2", " ", " 1", "1 ", String(maximumMoney + 1)] {
    check(positiveMoney(invalid) == nil)
}
check(positiveMoney(String(maximumMoney)) == maximumMoney)
// band/phrase 경계: 50% 미만 / 100% 미만 / 그 이상, 홀수 기준은 올림(budget/2 + budget%2)
for (budget, total, expected, text) in [
    (50_000, 24_999, "calm", "아직은 여유 있네"), (50_000, 25_000, "caution", "오늘 좀 쓰는데?"),
    (50_000, 49_999, "caution", "오늘 좀 쓰는데?"), (50_000, 50_000, "exceeded", "님 부자임?"),
    (50_001, 25_000, "calm", "아직은 여유 있네"), (50_001, 25_001, "caution", "오늘 좀 쓰는데?"),
    (50_001, 50_001, "exceeded", "님 부자임?"), (1, 0, "calm", "아직은 여유 있네"), (1, 1, "exceeded", "님 부자임?"),
    (maximumMoney, maximumMoney - 1, "caution", "오늘 좀 쓰는데?"), (maximumMoney, maximumMoney, "exceeded", "님 부자임?"),
] {
    check(LedgerBridgeState.band(total: total, budget: budget) == expected)
    check(phrase(total: total, budget: budget) == text)
}
let failed = try LedgerBridgeState.snapshot(ledger: nil, error: "읽기 실패", canReset: true)
check(failed["ledger"] is NSNull)
check((failed["error"] as! [String: Any])["canReset"] as? Bool == true)
check(JSONSerialization.isValidJSONObject(snapshot))
// removal 입력 경계: 발급받은 불투명 값만 받아들이고, 검증 실패는 크래시 없이 nil
var removable = SpendingLedger(now: date)
try removable.updateSettings(AppSettings(identity: .worker, dailyBudget: 50_000)!, monthlyBudget: nil, now: date)
removable.completeOnboarding(now: date)
for amount in [5_100, 8_700, 5_100] { try removable.addSpending(amount, expectedDay: removable.current.day, now: date) }
let issued = try JSONEncoder().encode(removable.current).base64EncodedString()
let stale = try JSONEncoder().encode(removable.current).base64EncodedString()
let picked = LedgerBridgeState.removal(index: 2, expectedCurrent: issued)!
check(picked.index == 2 && picked.expected == removable.current)
try removable.removeSpending(at: picked.index, expected: picked.expected, now: date)
check(removable.current.approvals == [5_100, 8_700])
check(removable.current.total == 13_800)
// 발급 뒤 목록이 바뀌면 Core가 거부한다
do { try removable.removeSpending(at: 0, expected: LedgerBridgeState.removal(index: 0, expectedCurrent: stale)!.expected, now: date); check(false) }
catch LedgerError.spendingChanged {}
for index in [-1, 3, Int.max, Int.min] { check(LedgerBridgeState.removal(index: index, expectedCurrent: issued) == nil) }
let wrong = "{\"day\":\"2026-11-11\",\"approvals\":[-5],\"carriedTotal\":0}"
let overflow = "{\"day\":\"2026-11-11\",\"approvals\":[\(maximumMoney),1],\"carriedTotal\":0}"
// 입력이 문법 오류 때문이 아니라 검증 때문에 거부되는지 확인: 모두 유효한 JSON이어야 한다
for json in [wrong, overflow] { check((try? JSONSerialization.jsonObject(with: Data(json.utf8))) != nil) }
// 각 값은 범위 안이지만 합이 maximumMoney를 넘는 경우만 거부하고, 합이 정확히 maximumMoney면 받아들인다
let atMaximum = "{\"day\":\"2026-11-11\",\"approvals\":[\(maximumMoney - 1),1],\"carriedTotal\":0}"
check(LedgerBridgeState.removal(index: 1, expectedCurrent: Data(atMaximum.utf8).base64EncodedString()) != nil)
for text in ["", "%%%", " ", issued + "=", Data("{}".utf8).base64EncodedString(), Data("not json".utf8).base64EncodedString(),
             Data(wrong.utf8).base64EncodedString(), Data(overflow.utf8).base64EncodedString()] {
    check(LedgerBridgeState.removal(index: 0, expectedCurrent: text) == nil)
}
// 이전 합계는 목록 항목이 아니라 삭제 대상이 될 수 없다
let carriedJSON = "{\"day\":\"2026-11-11\",\"approvals\":[3000],\"carriedTotal\":12000}"
let carried = Data(carriedJSON.utf8).base64EncodedString()
check(LedgerBridgeState.removal(index: 1, expectedCurrent: carried) == nil)
let carriedPick = LedgerBridgeState.removal(index: 0, expectedCurrent: carried)!
check(carriedPick.expected.carriedTotal == 12_000 && carriedPick.expected.total == 15_000)
// 설정 입력 경계: 지원 수단·양수 금액·알려진 신분만 받고, 나머지는 저장 전에 사유와 함께 거부한다
func request(_ patch: [String: Any] = [:]) -> [String: Any] {
    var base: [String: Any] = ["identity": "student", "dailyBudget": "20000", "monthlyBudget": NSNull(),
                               "sources": ["kbCheckSMS"], "finishOnboarding": false]
    for (key, value) in patch { base[key] = value }
    return base
}
func accepted(_ patch: [String: Any] = [:]) -> SettingsInput? {
    if case .success(let input) = LedgerBridgeState.settings(request(patch)) { return input }
    return nil
}
func rejection(_ patch: [String: Any]) -> SettingsRejection? {
    if case .failure(let reason) = LedgerBridgeState.settings(request(patch)) { return reason }
    return nil
}
let basic = accepted()!
check(basic.settings.identity == .student && basic.settings.dailyBudget == 20_000 && basic.settings.sources == [.kbCheckSMS])
check(basic.monthlyBudget == nil && basic.finishOnboarding == false)
let custom = accepted(["monthlyBudget": "1500000", "finishOnboarding": true, "identity": "jobSeeker", "dailyBudget": String(maximumMoney)])!
check(custom.monthlyBudget == 1_500_000 && custom.finishOnboarding && custom.settings.identity == .jobSeeker && custom.settings.dailyBudget == maximumMoney)
for bad in ["0", "-1", "1.5", " 1", "", "abc", String(maximumMoney + 1)] {
    check(rejection(["dailyBudget": bad]) == .amount)
    check(rejection(["monthlyBudget": bad]) == .amount)
}
// 숫자 타입은 문자열이 아니므로 거부
check(rejection(["dailyBudget": 20_000]) == .amount)
check(rejection(["monthlyBudget": 1_500_000]) == .amount)
check(rejection(["identity": "nobody"]) == .settings && rejection(["identity": 3]) == .settings)
check(rejection(["sources": []]) == .settings) // 빈 선택
check(rejection(["sources": ["tossNotification"]]) == .settings) // 준비 중 수단
check(rejection(["sources": ["kbCheckSMS", "tossNotification"]]) == .settings)
check(rejection(["sources": ["nope"]]) == .settings && rejection(["sources": "kbCheckSMS"]) == .settings)
check(rejection(["finishOnboarding": "yes"]) == .settings)
check(SettingsRejection.settings.message == LedgerBridgeState.invalidSettings)
check(SettingsRejection.amount.message == LedgerError.invalidAmount.errorDescription)
// 신분을 바꿔 저장해도 이미 쌓인 지난 날짜의 기준은 새 기본 기준에 덮이지 않는다(Core 규칙을 입력 경계 이후에도 확인)
let dayOne = ISO8601DateFormatter().date(from: "2026-11-10T12:00:00Z")!
let dayTwo = ISO8601DateFormatter().date(from: "2026-11-11T12:00:00Z")!
var history = SpendingLedger(now: dayOne)
try history.updateSettings(AppSettings(identity: .worker, dailyBudget: 50_000)!, monthlyBudget: nil, now: dayOne)
history.completeOnboarding(now: dayOne)
try history.addSpending(5_000, expectedDay: history.current.day, now: dayOne)
try history.updateSettings(basic.settings, monthlyBudget: basic.monthlyBudget, now: dayTwo)
check(history.settings.identity == .student && history.currentBudget == 20_000)
let pastKey = dayKey(for: dayOne, calendar: spendingCalendar())
check(history.records[pastKey]?.budget == 50_000 && history.records[pastKey]?.total == 5_000)
print("Bridge checks: exact money, invalid inputs, bands, removal input boundary, settings input boundary, missing ledger, metadata passed")
