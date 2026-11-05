import SwiftUI
import AYRCore

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var editing = false

    var body: some View {
        Form {
            if let ledger = model.ledger {
                Section("생활 기준") {
                    LabeledContent("신분", value: ledger.settings.identity.title)
                    LabeledContent("하루 기준", value: money(ledger.settings.dailyBudget))
                    LabeledContent("월 예산", value: ledger.monthlyBudget.map(money) ?? "하루 기준 × 그 달 일수")
                    Button("기준·결제 수단 수정") { editing = true }
                }
                Section("연결·표시") {
                    NavigationLink("자동화 설정 안내·수신 테스트") { ConnectionView() }
                    NavigationLink("위젯·Live Activity 안내") { DisplayGuideView().navigationTitle("잠금화면 표시") }
                }
                Section("기기 안에만 보관해요") {
                    Text("오늘 취소 대조용 승인 금액, 날짜별 합계·기준 금액을 최근 12개월만 보관합니다. 문자 원문과 가게 이름은 저장하지 않습니다.")
                    Text("자동화가 꺼진 날도 0원으로 보일 수 있습니다. 같은 문자 중복 수신은 두 번 합산될 수 있고, KB 취소 문자는 아직 지원하지 않습니다.")
                }
            }
        }
        .navigationTitle("설정")
        .sheet(isPresented: $editing) {
            if let ledger = model.ledger {
                NavigationStack {
                    SettingsEditor(settings: ledger.settings, monthlyBudget: ledger.monthlyBudget)
                }
            }
        }
    }
}

private struct SettingsEditor: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var identity: Identity
    @State private var budget: String
    @State private var sources: Set<PaymentSource>
    @State private var customMonthly: Bool
    @State private var monthly: String

    init(settings: AppSettings, monthlyBudget: Int?) {
        _identity = State(initialValue: settings.identity)
        _budget = State(initialValue: String(settings.dailyBudget))
        _sources = State(initialValue: settings.sources)
        _customMonthly = State(initialValue: monthlyBudget != nil)
        _monthly = State(initialValue: monthlyBudget.map(String.init) ?? "")
    }

    private var valid: Bool {
        positiveMoney(budget) != nil && !sources.isEmpty && (!customMonthly || positiveMoney(monthly) != nil)
    }

    var body: some View {
        Form {
            Section("신분·하루 기준") {
                IdentityBudgetFields(identity: $identity, budget: $budget)
                Text("오늘 지출은 유지하고 문구를 다시 계산합니다. 시간대 변경으로 다시 열린 보관 날짜는 원래 기준을 유지하고, 새 기준은 이후 날짜에 사용합니다.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Section("월 예산") {
                Toggle("직접 입력", isOn: $customMonthly)
                if customMonthly { MoneyField(title: "월 예산(원)", text: $monthly) }
                else { Text("하루 기준 금액 × 선택한 달의 일수로 계산합니다.") }
                Text("변경은 이번 달부터 반영하고 지난달 예산은 유지합니다. 직접 입력한 월 예산은 이후 달에도 기본으로 사용합니다.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Section("결제 수단") { SourcePicker(sources: $sources) }
            if !valid {
                Section {
                    Text("금액은 1~\(money(maximumMoney)) 범위의 숫자로 입력하고, 지원되는 결제 수단을 선택해주세요.")
                        .foregroundStyle(.red)
                }
            }
            if let error = model.error {
                Section("저장하지 못했어요") { Text(error).foregroundStyle(.red) }
            }
        }
        .navigationTitle("기준 수정")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("저장") {
                    guard let amount = positiveMoney(budget),
                          let settings = AppSettings(identity: identity, dailyBudget: amount, sources: sources),
                          model.save(settings: settings, monthlyBudget: customMonthly ? positiveMoney(monthly) : nil) else { return }
                    dismiss()
                    Task { await model.refreshActivity() }
                }
                .disabled(!valid)
            }
        }
    }
}
