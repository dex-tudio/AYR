import Foundation
import AYRCore

struct SettingsInput {
    let settings: AppSettings
    let monthlyBudget: Int?
    let finishOnboarding: Bool
}

/// JS에서 온 설정 입력을 저장 전에 거부한 사유. 메시지는 사용자에게 그대로 보인다.
enum SettingsRejection: Error {
    case settings, amount

    var message: String {
        switch self {
        case .settings: LedgerBridgeState.invalidSettings
        case .amount: LedgerError.invalidAmount.errorDescription ?? ""
        }
    }
}

enum LedgerBridgeState {
    static let invalidSettings = "설정 값을 확인해주세요. 신분과 연결할 수 있는 결제 수단을 골라야 해요."

    /// JS가 보낸 설정 요청을 검증한다. 신분·수단은 raw value와 지원 여부를, 금액은 양수·maximumMoney 이하 10진 문자열만 받는다.
    /// 지원하지 않거나 비어 있는 수단은 거부하고, 월 예산은 null이면 '하루 기준 × 일수'다.
    static func settings(_ request: [String: Any]) -> Result<SettingsInput, SettingsRejection> {
        guard let rawIdentity = request["identity"] as? String, let identity = Identity(rawValue: rawIdentity),
              let items = request["sources"] as? [Any], !items.isEmpty,
              let finish = request["finishOnboarding"] as? Bool else { return .failure(.settings) }
        // 원소를 하나씩 String으로 읽고, 하나라도 문자열이 아니면 거부한다(브릿지가 Optional로 감싼 원소도 방어).
        let rawSources = items.compactMap { $0 as? String }
        guard rawSources.count == items.count else { return .failure(.settings) }
        var sources = Set<PaymentSource>()
        for raw in rawSources {
            guard let source = PaymentSource(rawValue: raw), source.isSupported else { return .failure(.settings) }
            sources.insert(source)
        }
        guard let budgetText = request["dailyBudget"] as? String, let budget = positiveMoney(budgetText),
              let settings = AppSettings(identity: identity, dailyBudget: budget, sources: sources) else { return .failure(.amount) }
        var monthly: Int?
        if let value = request["monthlyBudget"], !(value is NSNull) {
            guard let text = value as? String, let amount = positiveMoney(text) else { return .failure(.amount) }
            monthly = amount
        }
        return .success(SettingsInput(settings: settings, monthlyBudget: monthly, finishOnboarding: finish))
    }

    static let invalidMonth = "볼 수 있는 달이 아니에요. 이번 달부터 11개월 전까지만 볼 수 있어요."
    /// 현재 월 시작 기준 이동 가능한 범위. 최근 12개월 보관 정책과 같다.
    static let monthOffsets = -11...0

    /// 현재 월 + offset의 월 집계. 합계·예산·비교·날짜별 문구와 구간은 Core `summary` 결과를 그대로 옮기고,
    /// 금액은 모두 10진 문자열이다. 기록 없음(noRecord)·0원(recorded)·아직 오지 않은 날(future)을 구분한다.
    /// offset이 범위 밖이면 nil.
    static func month(ledger: SpendingLedger, offset: Int, now: Date = Date(), calendar: Calendar = spendingCalendar()) -> [String: Any]? {
        guard monthOffsets.contains(offset) else { return nil }
        let calendar = spendingCalendar(timeZone: calendar.timeZone)
        let thisMonth = calendar.dateInterval(of: .month, for: now)!.start
        let start = calendar.date(byAdding: .month, value: offset, to: thisMonth)!
        let summary = ledger.summary(for: start, now: now, calendar: calendar)
        let today = dayKey(for: now, calendar: calendar)
        let parts = calendar.dateComponents([.year, .month], from: start)
        let days = summary.days.map { day -> [String: Any] in
            let status = day.total != nil ? "recorded" : day.key > today ? "future" : "noRecord"
            var value: [String: Any] = ["key": day.key, "day": calendar.component(.day, from: day.date), "status": status,
                                        "total": day.total.map { String($0) } as Any? ?? NSNull(),
                                        "budget": day.budget.map { String($0) } as Any? ?? NSNull(),
                                        "phrase": NSNull(), "band": NSNull()]
            if let total = day.total, let budget = day.budget {
                value["phrase"] = phrase(total: total, budget: budget)
                value["band"] = band(total: total, budget: budget)
            }
            return value
        }
        let comparison: Any = summary.comparison.map { difference in
            ["difference": String(abs(difference)), "direction": difference > 0 ? "more" : difference < 0 ? "less" : "same"] as [String: Any]
        } ?? NSNull()
        // 세 구간의 문구는 임계값을 복제하지 않고 Core `phrase`에서 얻는다.
        let bands = [("calm", phrase(total: 0, budget: 1)), ("caution", phrase(total: 1, budget: 2)), ("exceeded", phrase(total: 1, budget: 1))]
        let weekdaySymbols = calendar.veryShortStandaloneWeekdaySymbols
        let first = calendar.firstWeekday - 1
        return [
            "offset": offset, "monthKey": String(format: "%04d-%02d", parts.year!, parts.month!), "title": "\(parts.year!)년 \(parts.month!)월",
            "canGoPrevious": offset > monthOffsets.lowerBound, "canGoNext": offset < monthOffsets.upperBound,
            "weekdays": (0..<7).map { weekdaySymbols[(first + $0) % 7] },
            "leadingBlanks": (calendar.component(.weekday, from: start) - calendar.firstWeekday + 7) % 7,
            "days": days,
            "total": String(summary.total), "budget": String(summary.budget),
            "remaining": String(abs(summary.remaining)), "overBudget": summary.remaining < 0,
            "comparison": comparison,
            "phraseCounts": bands.map { ["band": $0.0, "phrase": $0.1, "days": summary.phraseCounts[$0.1, default: 0]] as [String: Any] }
        ]
    }

    /// 구간 경계는 Core `phrase`가 정한다. 같은 기준에서 합계 0과 기준 금액이 받는 문구로 비교해 임계값을 복제하지 않는다.
    static func band(total: Int, budget: Int) -> String {
        let current = phrase(total: total, budget: budget)
        if current == phrase(total: 0, budget: budget) { return "calm" }
        if current == phrase(total: budget, budget: budget) { return "exceeded" }
        return "caution"
    }

    /// JS가 돌려준 불투명 스냅샷과 index를 검증해 넘긴다. 디코드·범위 검증에 실패하면 nil이고,
    /// DailySpending(day:approvals:carriedTotal:)의 precondition 초기화는 호출하지 않는다. 이전 합계는 index 대상이 아니다.
    static func removal(index: Int, expectedCurrent: String) -> (index: Int, expected: DailySpending)? {
        guard let data = Data(base64Encoded: expectedCurrent),
              let expected = try? JSONDecoder().decode(DailySpending.self, from: data),
              expected.approvals.indices.contains(index) else { return nil }
        return (index, expected)
    }

    static func snapshot(ledger: SpendingLedger?, error: String? = nil, canReset: Bool = false,
                         activityNotice: String? = nil, activityEnabled: Bool = false,
                         resettingRecords: Bool = false) throws -> [String: Any] {
        var ledgerValue: Any = NSNull()
        if let ledger {
            let total = ledger.current.total
            let budget = ledger.currentBudget
            ledgerValue = [
                "onboardingCompleted": ledger.onboardingCompleted,
                "current": ["day": ledger.current.day, "total": String(total), "budget": String(budget),
                            "carriedTotal": String(ledger.current.carriedTotal),
                            "approvals": ledger.current.approvals.map { String($0) },
                            "expectedCurrent": try JSONEncoder().encode(ledger.current).base64EncodedString()],
                "settings": ["identity": ledger.settings.identity.rawValue, "dailyBudget": String(ledger.settings.dailyBudget),
                             "monthlyBudget": ledger.monthlyBudget.map { String($0) } as Any? ?? NSNull(),
                             "sources": PaymentSource.allCases.filter { ledger.settings.sources.contains($0) }.map(\.rawValue)],
                "lastReception": ledger.lastReception.map { ISO8601DateFormatter().string(from: $0) } as Any? ?? NSNull(),
                "lastAttempt": ledger.lastAttempt.map {
                    ["date": ISO8601DateFormatter().string(from: $0.date), "status": $0.status.rawValue, "message": $0.status.message]
                } as Any? ?? NSNull(),
                "phrase": phrase(total: total, budget: budget), "band": band(total: total, budget: budget)
            ] as [String: Any]
        }
        return [
            "ledger": ledgerValue,
            "error": error.map { ["message": $0, "canReset": canReset] as [String: Any] } as Any? ?? NSNull(),
            "activityNotice": activityNotice as Any? ?? NSNull(), "activityEnabled": activityEnabled,
            "resettingRecords": resettingRecords,
            "metadata": [
                "maximumMoney": String(maximumMoney),
                "identities": Identity.allCases.map { ["raw": $0.rawValue, "title": $0.title, "defaultBudget": String($0.defaultBudget)] },
                "sources": PaymentSource.allCases.map {
                    ["raw": $0.rawValue, "title": $0.title, "isSupported": $0.isSupported,
                     "filterKeyword": $0.filterKeyword as Any? ?? NSNull(), "testText": $0.testMessage,
                     "instructions": $0.isSupported ? "단축어에서 문자 자동화를 만들고 AYR 결제 처리에 본문을 전달해주세요." : "준비 중"] as [String: Any]
                }
            ] as [String: Any]
        ]
    }
}
