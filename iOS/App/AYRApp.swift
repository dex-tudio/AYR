import SwiftUI
import AYRCore

@main
struct AYRApp: App {
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase
    @State private var showingResetConfirmation = false

    var body: some Scene {
        WindowGroup {
            Group {
                if let ledger = model.ledger {
                    VStack(spacing: 0) {
                        if let error = model.error { errorBanner(error) }
                        if ledger.onboardingCompleted {
                            TabView {
                                NavigationStack { HomeView() }
                                    .tabItem { Label("오늘", systemImage: "sun.max") }
                                NavigationStack { MonthlyView() }
                                    .tabItem { Label("월별", systemImage: "calendar") }
                                NavigationStack { SettingsView() }
                                    .tabItem { Label("설정", systemImage: "gearshape") }
                            }
                        } else {
                            NavigationStack { OnboardingView(settings: ledger.settings) }
                        }
                    }
                } else {
                    ContentUnavailableView {
                        Label("기록을 불러오지 못했어요", systemImage: "externaldrive.badge.exclamationmark")
                    } description: {
                        Text(model.error ?? "기기 안의 기록을 불러옵니다.")
                    } actions: {
                        Button("다시 시도") { model.reload() }
                        if model.canResetRecords { recoveryButton }
                    }
                }
            }
            .environmentObject(model)
            .tint(AYRTheme.accent)
            .background(AYRTheme.background)
            .environment(\.locale, Locale(identifier: "ko_KR"))
            .environment(\.calendar, spendingCalendar())
            .task { await model.refreshActivity() }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    Task { await model.refreshActivity() }
                }
            }
            .onReceive(Timer.publish(every: 30, on: .main, in: .common).autoconnect()) { _ in
                if scenePhase == .active { model.reload() }
            }
            .alert("기록을 새로 시작할까요?", isPresented: $showingResetConfirmation) {
                Button("취소", role: .cancel) { }
                Button("원본 보존 후 새로 시작", role: .destructive) {
                    Task { await model.resetRecords() }
                }
            } message: {
                Text("현재 기록은 앱에서 볼 수 없게 됩니다. 원본은 기기 안에 별도로 보존하고, 온보딩부터 새 기록을 시작합니다.")
            }
        }
    }

    private func errorBanner(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(message, systemImage: "exclamationmark.triangle")
            Button("다시 읽기") { model.reload() }
            if model.canResetRecords { recoveryButton }
        }
        .font(.footnote)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.orange.opacity(0.15))
    }

    private var recoveryButton: some View {
        Button("원본을 보존하고 새로 시작", role: .destructive) { showingResetConfirmation = true }
            .disabled(model.resettingRecords)
    }
}
