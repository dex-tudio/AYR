import ActivityKit
import SwiftUI
import AYRCore

struct DisplayGuideView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var enabled = ActivityAuthorizationInfo().areActivitiesEnabled

    var body: some View {
        Form {
            Section("Live Activity") {
                Label(enabled ? "사용 가능" : "설정에서 허용해주세요", systemImage: enabled ? "checkmark.circle" : "exclamationmark.circle")
                Text("설정을 마치면 앱 실행과 결제 처리 때 오늘 합계·문구를 표시합니다. 활성 상태는 최대 8시간이며 잠금화면에서도 최대 12시간 후 사라집니다.")
                Link("AYR 설정 열기", destination: URL(string: UIApplication.openSettingsURLString)!)
            }
            Section("잠금화면 위젯") {
                Text("1. 잠금화면을 길게 누르고 사용자화를 선택하세요.")
                Text("2. 잠금화면 → 위젯 추가 → AYR을 선택하세요.")
                Text("3. 오늘 합계와 문구가 보이는 위젯을 추가하세요.")
                Text("날짜가 바뀌면 0원 항목을 예약합니다. 정확한 갱신 시점은 iOS가 결정합니다.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { enabled = ActivityAuthorizationInfo().areActivitiesEnabled }
        }
    }
}

struct AutomationGuideView: View {
    private let keyword = PaymentSource.kbCheckSMS.filterKeyword ?? ""

    var body: some View {
        Form {
            Section("KB국민 체크카드 · 문자") {
                Text("처음 한 번만 설정하면 이후 결제 문자는 자동으로 반영됩니다.")
                Button("1. 문구 복사: (keyword)") { UIPasteboard.general.string = keyword }
                Link("2. 단축어 앱 열기", destination: URL(string: "shortcuts://")!)
                Text("3. 자동화 탭에서 새 자동화를 만들고 메시지를 선택하세요.")
                Text("4. 메시지에 포함되는 문구에 복사한 문구를 붙여 넣고, 즉시 실행을 선택하세요.")
                Text("5. 동작에서 AYR 결제 처리를 추가하세요.")
                Text("6. 문자 본문에 단축어 입력의 메시지 본문을 연결하세요. 고정된 문구를 입력하지 마세요.")
            }
            Section {
                Text("자동화는 앱이 대신 만들 수 없습니다. iOS 버전에 따라 메뉴 이름이 다를 수 있습니다. 같은 결제를 두 번 합산하지 않도록 KB 자동화는 하나만 유지하세요.")
                Text("실제 원문·금액·가게 이름을 로그나 메모, 외부 서비스로 보내는 동작은 추가하지 마세요.")
            }
        }
    }
}

struct ReceptionTestView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.scenePhase) private var scenePhase
    private let testMessage = PaymentSource.kbCheckSMS.testMessage

    var body: some View {
        Form {
            Section("자동화 수신 테스트") {
                Text("아래 가짜 문구를 복사해 자기 자신에게 메시지로 보내세요. 테스트는 지출에 합산하지 않습니다.")
                Text(testMessage).font(.body.monospaced()).textSelection(.enabled)
                Button("테스트 문구 복사") { UIPasteboard.general.string = testMessage }
                Button("수신 상태 다시 확인") { model.reload() }
                if let ledger = model.ledger { ReceptionStatusView(ledger: ledger) }
            }
            Section {
                Text("자기 자신에게 보낸 메시지에 반응하지 않을 수도 있습니다. 먼저 온보딩의 시작하기를 눌러 설정을 완료한 뒤, 다음 평소 KB 결제 때 확인하세요. 완료 전 실제 결제 문자는 반영하지 않습니다. 테스트를 위해 새로 결제할 필요는 없습니다.")
                Text("수신 확인은 나중으로 미뤄도 시작할 수 있습니다. 테스트 문구 수신은 실제 결제 수집 성공을 뜻하지 않습니다.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .onReceive(Timer.publish(every: 3, on: .main, in: .common).autoconnect()) { _ in
            if scenePhase == .active { model.reload() }
        }
    }
}

struct ConnectionView: View {
    var body: some View {
        List {
            NavigationLink("자동화 설정 안내") { AutomationGuideView().navigationTitle("자동화 설정") }
            NavigationLink("수신 테스트") { ReceptionTestView().navigationTitle("수신 테스트") }
        }
        .navigationTitle("결제 문자 연결")
    }
}
