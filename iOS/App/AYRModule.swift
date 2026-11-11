import ActivityKit
import AYRCore
import ExpoModulesCore

final class AYRModule: Module {
    private var model: AppModel?

    func definition() -> ModuleDefinition {
        Name("AYRNative")
        AsyncFunction("getSnapshot") { () async throws -> [String: Any] in
            try await self.getSnapshot()
        }
        AsyncFunction("addSpending") { (amount: String, expectedDay: String) async throws -> [String: Any] in
            try await self.addSpending(amount, expectedDay: expectedDay)
        }
        AsyncFunction("saveSettings") { (request: [String: Any]) async throws -> [String: Any] in
            try await self.saveSettings(request)
        }
        AsyncFunction("resetRecords") { () async throws -> [String: Any] in
            try await self.resetRecords()
        }
        AsyncFunction("removeSpending") { (index: Int, expectedCurrent: String) async throws -> [String: Any] in
            try await self.removeSpending(index, expectedCurrent: expectedCurrent)
        }
    }

    @MainActor
    private func appModel() -> AppModel {
        let model = self.model ?? AppModel()
        self.model = model
        return model
    }

    @MainActor
    private func getSnapshot() throws -> [String: Any] {
        let model = appModel()
        model.reload()
        return try snapshot(of: model)
    }

    /// 현재 모델 상태를 그대로 담는다. 저장 실패 직후에는 다시 읽지 않아 실패 안내가 사라지지 않는다.
    @MainActor
    private func snapshot(of model: AppModel, rejection: String? = nil) throws -> [String: Any] {
        try LedgerBridgeState.snapshot(
            ledger: model.ledger, error: rejection ?? model.error,
            canReset: rejection == nil && model.canResetRecords,
            activityNotice: model.activityNotice,
            activityEnabled: ActivityAuthorizationInfo().areActivitiesEnabled,
            resettingRecords: model.resettingRecords
        )
    }

    @MainActor
    private func saved(_ model: AppModel) async throws -> [String: Any] {
        // 저장에 성공한 변경만 Live Activity를 다시 맞춘다. 표시 실패는 activityNotice로 구분한다.
        await model.refreshActivity()
        return ["ok": true, "snapshot": try snapshot(of: model)]
    }

    /// 앱 모델이 저장을 시도하기 전에 입력 경계에서 거부한 경우. 최신 기록을 보여주되 거부 사유를 안내로 쓴다.
    @MainActor
    private func rejected(_ model: AppModel, _ reason: String) throws -> [String: Any] {
        model.reload()
        return ["ok": false, "snapshot": try snapshot(of: model, rejection: reason)]
    }

    @MainActor
    private func addSpending(_ amount: String, expectedDay: String) async throws -> [String: Any] {
        let model = appModel()
        guard let value = positiveMoney(amount) else { return try rejected(model, LedgerError.invalidAmount.errorDescription ?? "") }
        if model.addSpending(value, expectedDay: expectedDay) { return try await saved(model) }
        return ["ok": false, "snapshot": try snapshot(of: model)]
    }

    @MainActor
    private func removeSpending(_ index: Int, expectedCurrent: String) async throws -> [String: Any] {
        let model = appModel()
        guard let removal = LedgerBridgeState.removal(index: index, expectedCurrent: expectedCurrent) else {
            return try rejected(model, LedgerError.spendingChanged.errorDescription ?? "")
        }
        if model.removeSpending(at: removal.index, expected: removal.expected) { return try await saved(model) }
        return ["ok": false, "snapshot": try snapshot(of: model)]
    }

    @MainActor
    private func saveSettings(_ request: [String: Any]) async throws -> [String: Any] {
        let model = appModel()
        switch LedgerBridgeState.settings(request) {
        case .failure(let rejection):
            return try rejected(model, rejection.message)
        case .success(let input):
            if model.save(settings: input.settings, monthlyBudget: input.monthlyBudget, finishOnboarding: input.finishOnboarding) {
                return try await saved(model)
            }
            return ["ok": false, "snapshot": try snapshot(of: model)]
        }
    }

    /// 손상된 기록에만 허용한다. UI의 명시적 확인 뒤에 호출되고, 원본 보관·재검사·위젯 갱신·Activity 종료는 AppModel이 한다.
    @MainActor
    private func resetRecords() async throws -> [String: Any] {
        let model = appModel()
        guard model.canResetRecords, !model.resettingRecords else {
            return try rejected(model, SpendingStoreError.resetNotNeeded.errorDescription ?? "")
        }
        await model.resetRecords()
        return ["ok": model.error == nil && model.ledger != nil, "snapshot": try snapshot(of: model)]
    }
}
