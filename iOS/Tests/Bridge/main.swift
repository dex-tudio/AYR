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
check(rejection(["sources": ["kbCheckSMS", 3]]) == .settings && rejection(["sources": [NSNull()]]) == .settings)
// 브릿지가 원소를 Optional로 감싸 넘겨도 문자열이면 받아들인다
let wrapped: [Any] = [Optional("kbCheckSMS") as Any]
check(accepted(["sources": wrapped])?.settings.sources == [.kbCheckSMS])
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
// getMonth: 월 집계와 문구·상태는 Core summary 결과를 그대로 옮긴다
func at(_ day: String) -> Date { ISO8601DateFormatter().date(from: day + "T12:00:00Z")! }
func monthLedger(start: String, budget: Int = 50_000, monthly: Int? = 1_500_000) throws -> SpendingLedger {
    var result = SpendingLedger(now: at(start))
    try result.updateSettings(AppSettings(identity: .worker, dailyBudget: budget)!, monthlyBudget: monthly, now: at(start))
    result.completeOnboarding(now: at(start))
    return result
}
func spend(_ target: inout SpendingLedger, _ day: String, _ amount: Int) throws {
    try target.addSpending(amount, expectedDay: day, now: at(day))
}
func monthDays(_ month: [String: Any]) -> [[String: Any]] { month["days"] as! [[String: Any]] }
var feb = try monthLedger(start: "2026-02-01")
for day in 1...28 { try spend(&feb, String(format: "2026-02-%02d", day), 1_000) }
for day in 1...31 { try spend(&feb, String(format: "2026-03-%02d", day), 2_000) }
let marchNow = at("2026-03-31")
let march = LedgerBridgeState.month(ledger: feb, offset: 0, now: marchNow)!
check(march["title"] as? String == "2026년 3월" && march["monthKey"] as? String == "2026-03" && march["offset"] as? Int == 0)
check(monthDays(march).count == 31)
check(march["total"] as? String == "62000" && march["budget"] as? String == "1500000" && march["remaining"] as? String == "1438000")
check(march["overBudget"] as? Bool == false)
check(monthDays(march).reduce(0) { $0 + Int($1["total"] as! String)! } == 62_000)
// 3월 31일 대 2월 28일: 더 짧은 쪽(28일) 전월과 같은 기간 비교
let shortComparison = march["comparison"] as! [String: Any]
check(shortComparison["difference"] as? String == "34000" && shortComparison["direction"] as? String == "more")
check(march["canGoPrevious"] as? Bool == true && march["canGoNext"] as? Bool == false)
check((march["weekdays"] as! [String]).count == 7 && (0...6).contains(march["leadingBlanks"] as! Int))
let lastDay = monthDays(march)[30]
check(lastDay["key"] as? String == "2026-03-31" && lastDay["day"] as? Int == 31 && lastDay["status"] as? String == "recorded")
check(lastDay["total"] as? String == String(feb.current.total) && lastDay["budget"] as? String == "50000" && lastDay["band"] as? String == "calm")
check(lastDay["phrase"] as? String == phrase(total: 2_000, budget: 50_000))
let previous = LedgerBridgeState.month(ledger: feb, offset: -1, now: marchNow)!
check(previous["title"] as? String == "2026년 2월" && previous["canGoNext"] as? Bool == true && monthDays(previous).count == 28)
// 전월 기록에 비어 있는 날이 있으면 0이 아니라 비교 근거 없음
check(previous["comparison"] is NSNull)
var fresh = try monthLedger(start: "2026-03-01")
try spend(&fresh, "2026-03-04", 1_000)
check(LedgerBridgeState.month(ledger: fresh, offset: 0, now: at("2026-03-04"))!["comparison"] is NSNull)
// -11...0만 받는다
for bad in [-12, 1, Int.min, Int.max] { check(LedgerBridgeState.month(ledger: feb, offset: bad, now: marchNow) == nil) }
let oldest = LedgerBridgeState.month(ledger: feb, offset: -11, now: marchNow)!
check(oldest["title"] as? String == "2025년 4월" && oldest["canGoPrevious"] as? Bool == false)
// 기록 없음 / 0원 / 아직 오지 않은 날을 구분한다
var late = try monthLedger(start: "2026-03-05")
let lateMonth = LedgerBridgeState.month(ledger: late, offset: 0, now: at("2026-03-10"))!
let statuses = monthDays(lateMonth).map { $0["status"] as! String }
check(statuses[0..<4].allSatisfy { $0 == "noRecord" } && statuses[4..<10].allSatisfy { $0 == "recorded" } && statuses[10...].allSatisfy { $0 == "future" })
check(monthDays(lateMonth)[4]["total"] as? String == "0" && monthDays(lateMonth)[0]["total"] is NSNull && monthDays(lateMonth)[10]["total"] is NSNull)
check(monthDays(lateMonth)[0]["phrase"] is NSNull && monthDays(lateMonth)[0]["band"] is NSNull)
check(lateMonth["total"] as? String == "0")
// 50%/100% 경계와 문구별 일수
var edges = try monthLedger(start: "2026-03-01")
for (index, amount) in [24_999, 25_000, 49_999, 50_000].enumerated() { try spend(&edges, String(format: "2026-03-%02d", index + 1), amount) }
let edgeMonth = LedgerBridgeState.month(ledger: edges, offset: 0, now: at("2026-03-04"))!
let counts = (edgeMonth["phraseCounts"] as! [[String: Any]]).map { [$0["band"] as! String, $0["phrase"] as! String, String($0["days"] as! Int)] }
check(counts == [["calm", "아직은 여유 있네", "1"], ["caution", "오늘 좀 쓰는데?", "2"], ["exceeded", "님 부자임?", "1"]])
check(monthDays(edgeMonth).prefix(4).map { $0["band"] as! String } == ["calm", "caution", "caution", "exceeded"])
// 월 예산을 넘으면 초과분을 보여준다
var tight = try monthLedger(start: "2026-03-01", monthly: 10_000)
try spend(&tight, "2026-03-02", 30_000)
let tightMonth = LedgerBridgeState.month(ledger: tight, offset: 0, now: at("2026-03-02"))!
check(tightMonth["remaining"] as? String == "20000" && tightMonth["overBudget"] as? Bool == true)
// 월 예산을 바꾸면 이번 달만 바뀌고 지난달 예산은 유지된다
try feb.updateSettings(AppSettings(identity: .worker, dailyBudget: 50_000)!, monthlyBudget: 2_000_000, now: marchNow)
check(LedgerBridgeState.month(ledger: feb, offset: 0, now: marchNow)!["budget"] as? String == "2000000")
check(LedgerBridgeState.month(ledger: feb, offset: -1, now: marchNow)!["budget"] as? String == "1500000")
// 추가/삭제 뒤 오늘과 월 합계가 함께 바뀐다
try spend(&feb, "2026-03-31", 5_100)
let added = LedgerBridgeState.month(ledger: feb, offset: 0, now: marchNow)!
check(added["total"] as? String == "67100" && monthDays(added)[30]["total"] as? String == String(feb.current.total))
try feb.removeSpending(at: feb.current.approvals.count - 1, expected: feb.current, now: marchNow)
check(LedgerBridgeState.month(ledger: feb, offset: 0, now: marchNow)!["total"] as? String == "62000")
// 정확한 큰 금액: JS 안전 정수 범위를 넘어도 문자열로 나간다
var huge = try monthLedger(start: "2026-03-01", budget: maximumMoney, monthly: maximumMoney)
try spend(&huge, "2026-03-01", maximumMoney)
let hugeMonth = LedgerBridgeState.month(ledger: huge, offset: 0, now: at("2026-03-01"))!
check(hugeMonth["total"] as? String == String(maximumMoney) && monthDays(hugeMonth)[0]["total"] as? String == String(maximumMoney))
check(JSONSerialization.isValidJSONObject(hugeMonth) && JSONSerialization.isValidJSONObject(march))
print("Bridge checks: exact money, invalid inputs, bands, removal input boundary, settings input boundary, month summary, missing ledger, metadata passed")
