import ActivityKit
import SwiftUI
import AYRCore

struct DisplayGuideView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var enabled = ActivityAuthorizationInfo().areActivitiesEnabled

    var body: some View {
        Form {
            Section("실시간 지출") {
                Label(enabled ? "잠금화면에 표시할 수 있어요" : "설정에서 허용해주세요", systemImage: enabled ? "checkmark.circle" : "exclamationmark.circle")
                Text("설정을 마치면 앱을 열거나 결제 문자가 올 때 오늘 쓴 돈을 보여줘요. 실시간 표시는 최대 8시간 유지되고, 잠금화면에서도 최대 12시간 뒤 사라져요.")
                Link("AYR 설정 열기", destination: URL(string: UIApplication.openSettingsURLString)!)
            }
            Section("잠금화면 위젯") {
                Text("1. 잠금화면을 길게 누르고 사용자화를 선택하세요.")
                Text("2. 잠금화면 → 위젯 추가 → AYR을 선택하세요.")
                Text("3. 오늘 쓴 돈과 한마디가 보이는 위젯을 추가하세요.")
                Text("새날이 되면 0원부터 다시 보여줘요. 화면이 바뀌는 시점은 iOS가 정해 반영이 늦어질 수 있어요.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .ayrScreen()
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { enabled = ActivityAuthorizationInfo().areActivitiesEnabled }
        }
    }
}

struct AutomationGuideView: View {
    @EnvironmentObject private var model: AppModel

    private var sources: [PaymentSource] { model.ledger?.settings.smsAutomationSources ?? [] }

    var body: some View {
        Form {
            Section {
                Label("한 번 연결하면, 알아서.", systemImage: "bolt.horizontal.circle.fill")
                    .font(.system(.title2, design: .rounded, weight: .bold))
                Text("아래 순서대로 단축어 자동화를 설정해주세요.")
                    .foregroundStyle(.secondary)
            }
            if sources.isEmpty {
                Section("연결할 수단이 없어요") {
                    Text("온보딩이나 설정에서 연결할 수 있는 결제 수단을 먼저 선택해주세요.")
                }
            }
            ForEach(sources, id: \.self) { source in
                Section(source.title) {
                    if let keyword = source.filterKeyword {
                        Text(keyword).font(.body.monospaced()).textSelection(.enabled)
                        Button("연결 문구 복사") { UIPasteboard.general.string = keyword }
                            .accessibilityLabel("\(source.title) 연결 문구 복사")
                    }
                }
            }
            if !sources.isEmpty {
                Section("공통 설정 순서") {
                    Text("선택한 수단의 연결 문구를 복사한 뒤 같은 순서로 설정해주세요.")
                    Link("1. 단축어 앱 열기", destination: URL(string: "shortcuts://")!)
                    Text("2. 자동화 탭에서 새 자동화를 만들고 메시지를 선택하세요.")
                    Text("3. 메시지에 포함되는 문구에 복사한 문구를 붙여 넣고, 즉시 실행을 선택하세요.")
                    Text("4. 동작에서 AYR 결제 처리를 추가하세요.")
                    Text("5. 문자 본문에 단축어 입력의 메시지 본문을 연결하세요. 고정된 문구를 입력하지 마세요.")
                }
            }
            Section {
                Text("자동화는 단축어 앱에서 직접 만들어주세요. iOS 버전에 따라 메뉴 이름이 조금 다를 수 있어요. 같은 문자가 여러 자동화에 걸리면 두 번 더해질 수 있어요. 연결 문구가 겹치는 자동화는 하나만 유지해주세요.")
                Text("문자 본문 전체를 전달하면 앱이 결제 수단과 금액을 확인해요. 단축어에서 금액을 따로 추출하지 않아도 돼요.")
                Text("일정 금액 이상만 문자를 받으면 소액 결제가 빠져요. 카드사의 문자 알림 조건도 확인해주세요.")
                Text("결제 문자와 금액, 가게 이름이 메모나 외부 서비스에 남지 않도록 다른 동작은 추가하지 마세요.")
            }
        }
        .ayrScreen()
    }
}

struct ReceptionTestView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.scenePhase) private var scenePhase
    private var sources: [PaymentSource] { model.ledger?.settings.smsAutomationSources ?? [] }

    var body: some View {
        Form {
            Section {
                Text("선택한 수단의 확인용 문구를 복사해 나에게 문자로 보내보세요. 오늘 쓴 돈에는 더해지지 않아요.")
                if sources.isEmpty {
                    Text("온보딩이나 설정에서 연결할 수 있는 결제 수단을 먼저 선택해주세요.")
                }
            }
            ForEach(sources, id: \.self) { source in
                Section(source.title) {
                    Text(source.testMessage).font(.body.monospaced()).textSelection(.enabled)
                    Button("확인용 문구 복사") { UIPasteboard.general.string = source.testMessage }
                        .accessibilityLabel("\(source.title) 확인용 문구 복사")
                }
            }
            Section("마지막 자동화 호출") {
                Button("다시 확인하기") { model.reload() }
                if let ledger = model.ledger { ReceptionStatusView(ledger: ledger) }
            }
            Section {
                Text("나에게 보낸 문자는 자동화가 실행되지 않을 수도 있어요. 시작하기를 눌러 설정을 마친 뒤, 다음 평소 결제 때 확인해도 괜찮아요. 설정을 마치기 전에는 실제 결제도 더해지지 않아요. 확인하려고 새로 결제할 필요는 없어요.")
                Text("연결 확인은 나중에 해도 돼요. 확인용 문자가 도착해도 실제 결제가 잘 더해지는지는 다음 결제 때 확인해주세요.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .ayrScreen()
        .onReceive(Timer.publish(every: 3, on: .main, in: .common).autoconnect()) { _ in
            if scenePhase == .active { model.reload() }
        }
    }
}

struct ConnectionView: View {
    var body: some View {
        List {
            Section {
                Label("결제 문자 → 오늘 쓴 돈", systemImage: "bolt.horizontal.circle.fill")
                    .font(.system(.title2, design: .rounded, weight: .bold))
                Text("결제 문자가 오늘 쓴 돈에 더해지도록 연결해요.")
                    .foregroundStyle(.secondary)
            }
            NavigationLink("연결 방법 보기") { AutomationGuideView().navigationTitle("결제 문자 연결") }
            NavigationLink("연결 확인하기") { ReceptionTestView().navigationTitle("연결 확인") }
        }
        .ayrScreen()
        .navigationTitle("결제 문자 연결")
    }
}
