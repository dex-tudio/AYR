import ActivityKit
import ExpoModulesCore

final class AYRModule: Module {
    private var model: AppModel?

    func definition() -> ModuleDefinition {
        Name("AYRNative")
        AsyncFunction("getSnapshot") { () async throws -> [String: Any] in
            try await self.getSnapshot()
        }
    }

    @MainActor
    private func getSnapshot() throws -> [String: Any] {
        let model = self.model ?? AppModel()
        self.model = model
        model.reload()
        return try LedgerBridgeState.snapshot(
            ledger: model.ledger, error: model.error, canReset: model.canResetRecords,
            activityNotice: model.activityNotice,
            activityEnabled: ActivityAuthorizationInfo().areActivitiesEnabled,
            resettingRecords: model.resettingRecords
        )
    }
}
