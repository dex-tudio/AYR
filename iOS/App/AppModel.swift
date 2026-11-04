import AYRCore
import Combine
import Foundation
import WidgetKit

@MainActor
final class AppModel: ObservableObject {
    @Published private(set) var ledger: SpendingLedger?
    @Published private(set) var error: String?
    @Published private(set) var activityNotice: String?

    func reload() {
        do {
            ledger = try SpendingStore().read()
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    @discardableResult
    func save(settings: AppSettings, monthlyBudget: Int?, finishOnboarding: Bool = false) -> Bool {
        do {
            ledger = try SpendingStore().modify {
                try $0.updateSettings(settings, monthlyBudget: monthlyBudget)
                if finishOnboarding { $0.completeOnboarding() }
            }
            error = nil
            WidgetCenter.shared.reloadAllTimelines()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func refreshActivity() async {
        // 저장 뒤 다른 Intent가 실행됐을 수 있으므로 최신 합계를 다시 읽는다.
        reload()
        guard error == nil, let ledger else { return }
        activityNotice = await LiveActivityManager.sync(ledger)
    }
}
