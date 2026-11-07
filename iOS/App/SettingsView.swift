import SwiftUI
import AYRCore

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var editing = false

    var body: some View {
        Form {
            if let ledger = model.ledger {
                Section("생활 기준") {
                    Label("내 생활, 내 기준", systemImage: "slider.horizontal.3")
                        .font(.system(.title2, design: .rounded, weight: .bold))
                    LabeledContent("신분", value: ledger.settings.identity.title)
                    LabeledContent("하루 기준", value: money(ledger.settings.dailyBudget))
                    LabeledContent("월 예산", value: ledger.monthlyBudget.map(money) ?? "하루 기준 × 그 달 일수")
                    Button("내 기준 바꾸기") { editing = true }
                }
                Section("연결·표시") {
                    NavigationLink("결제 문자 연결하기") { ConnectionView() }
                    NavigationLink("잠금화면 설정하기") { DisplayGuideView().navigationTitle("잠금화면 표시") }
                }
                Section("기기 안에만 보관해요") {
                    Text("오늘의 개별 지출 금액과 최근 12개월의 날짜별 합계·기준 금액만 보관해요. 문자 내용과 가게 이름은 저장하지 않아요.")
                    Text("자동화가 꺼져 놓친 결제도 0원으로 보일 수 있어요. 같은 문자가 다시 오면 두 번 더해질 수 있고, KB 결제 취소는 아직 반영되지 않아요.")
                }
            }
        }
        .ayrScreen()
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
                Text("오늘 쓴 돈은 그대로 두고 한마디만 새 기준에 맞춰 바꿔요. 시간대를 바꿔 다시 보는 날짜에는 당시 기준을 사용하고, 새 기준은 이후 날짜부터 적용해요.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Section("월 예산") {
                Toggle("직접 입력", isOn: $customMonthly)
                if customMonthly { MoneyField(title: "월 예산(원)", text: $monthly) }
                else { Text("하루 기준에 그 달의 일수를 곱해 정해요.") }
                Text("바꾼 예산은 이번 달부터 적용돼요. 지난달 예산은 그대로 두고, 직접 정한 금액은 다음 달에도 이어서 사용해요.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Section("결제 수단") { SourcePicker(sources: $sources) }
            if !valid {
                Section {
                    Text("금액은 1~\(money(maximumMoney)) 사이의 숫자로 적고, 연결할 수 있는 결제 수단을 골라주세요.")
                        .foregroundStyle(.red)
                }
            }
            if let error = model.error {
                Section("저장하지 못했어요") { Text(error).foregroundStyle(.red) }
            }
        }
        .ayrScreen()
        .navigationTitle("내 기준 바꾸기")
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
