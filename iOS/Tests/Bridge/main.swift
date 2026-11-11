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
    check(LedgerBridgeState.positiveMoney(invalid) == nil)
}
check(LedgerBridgeState.positiveMoney(String(maximumMoney)) == maximumMoney)
let failed = try LedgerBridgeState.snapshot(ledger: nil, error: "읽기 실패", canReset: true)
check(failed["ledger"] is NSNull)
check((failed["error"] as! [String: Any])["canReset"] as? Bool == true)
check(JSONSerialization.isValidJSONObject(snapshot))
print("Bridge checks: exact money, invalid inputs, missing ledger, metadata passed")
