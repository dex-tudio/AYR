import Foundation
import AYRCore

enum LedgerBridgeState {
    static func positiveMoney(_ text: String) -> Int? {
        guard !text.isEmpty, text.allSatisfy({ $0.isASCII && $0.isNumber }),
              let value = Int(text), value > 0, value <= maximumMoney else { return nil }
        return value
    }

    static func snapshot(ledger: SpendingLedger?, error: String? = nil, canReset: Bool = false,
                         activityNotice: String? = nil, activityEnabled: Bool = false,
                         resettingRecords: Bool = false) throws -> [String: Any] {
        var ledgerValue: Any = NSNull()
        if let ledger {
            let total = ledger.current.total
            let budget = ledger.currentBudget
            let band = total < budget / 2 + budget % 2 ? "calm" : total < budget ? "caution" : "exceeded"
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
                "phrase": phrase(total: total, budget: budget), "band": band
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
