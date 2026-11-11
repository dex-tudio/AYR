import Foundation
import AYRCore

enum LedgerBridgeState {
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
