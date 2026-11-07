import AppIntents
import AYRCore
import Foundation
import WidgetKit

struct ProcessPaymentIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "AYR 결제 처리"
    static var description = IntentDescription("결제 문자를 오늘 쓴 돈에 더하고 잠금화면에 보여줘요. 문자 내용은 저장하지 않아요.")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "문자 본문")
    var text: String

    static var parameterSummary: some ParameterSummary {
        Summary("AYR 결제 처리: \(\.$text)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        var counted = false
        var receptionError: LedgerError?
        let ledger = try SpendingStore().modify { ledger in
            // 처리 실패도 저장한 뒤 알리므로 앱에서 마지막 호출 결과를 확인할 수 있다.
            do { counted = try ledger.receive(text) }
            catch let error as LedgerError { receptionError = error }
        }
        WidgetCenter.shared.reloadAllTimelines()
        if let receptionError { throw receptionError }
        let activityNotice = await LiveActivityManager.sync(ledger)
        let message: String
        if text.contains(PaymentSource.testMarker) {
            message = ReceptionStatus.test.message
        } else if counted {
            message = activityNotice ?? ReceptionStatus.success.message
        } else {
            message = ReceptionStatus.ignored.message
        }
        return .result(dialog: IntentDialog(stringLiteral: message))
    }
}

struct AYRShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: ProcessPaymentIntent(), phrases: ["\(.applicationName) 결제 처리"], shortTitle: "AYR 결제 처리", systemImageName: "creditcard")
    }
}
