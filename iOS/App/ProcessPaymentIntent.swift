import AppIntents
import AYRCore
import Foundation
import WidgetKit

struct ProcessPaymentIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "AYR 결제 처리"
    static var description = IntentDescription("결제 문자 본문을 받아 오늘 합계와 잠금화면을 갱신합니다. 원문은 저장하지 않습니다.")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "문자 본문")
    var text: String

    static var parameterSummary: some ParameterSummary {
        Summary("AYR 결제 처리: \(\.$text)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        var counted = false
        let ledger = try SpendingStore().modify { ledger in
            guard ledger.onboardingCompleted || text.contains(PaymentSource.testMarker) else { throw PaymentIntentError.setupRequired }
            counted = try ledger.receive(text)
        }
        WidgetCenter.shared.reloadAllTimelines()
        let activityNotice = await LiveActivityManager.sync(ledger)
        let message: String
        if text.contains(PaymentSource.testMarker) {
            message = "수신 테스트 완료. 지출에는 합산하지 않았습니다."
        } else if counted {
            message = activityNotice ?? "결제를 반영했습니다."
        } else {
            message = "지원되는 결제 승인 문자가 아니어서 합산하지 않았습니다."
        }
        return .result(dialog: IntentDialog(stringLiteral: message))
    }
}

private enum PaymentIntentError: LocalizedError {
    case setupRequired
    var errorDescription: String? { "AYR 앱에서 온보딩을 먼저 완료해주세요." }
}

struct AYRShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: ProcessPaymentIntent(), phrases: ["\(.applicationName) 결제 처리"], shortTitle: "AYR 결제 처리", systemImageName: "creditcard")
    }
}
