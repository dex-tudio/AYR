import Foundation
import AYRCore

func check(_ condition: @autoclosure () -> Bool) { precondition(condition()) }
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
print("Bridge checks: exact money, invalid inputs, bands, missing ledger, metadata passed")
