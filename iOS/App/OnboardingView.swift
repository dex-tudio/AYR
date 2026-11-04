import SwiftUI
import AYRCore

struct OnboardingView: View {
    @EnvironmentObject private var model: AppModel
    @State private var step = 1
    @State private var identity: Identity
    @State private var budget: String
    @State private var sources: Set<PaymentSource>

    init(settings: AppSettings) {
        _identity = State(initialValue: settings.identity)
        _budget = State(initialValue: String(settings.dailyBudget))
        _sources = State(initialValue: settings.sources)
    }

    private var settings: AppSettings? {
        guard let value = positiveMoney(budget) else { return nil }
        return AppSettings(identity: identity, dailyBudget: value, sources: sources)
    }

    var body: some View {
        VStack(spacing: 0) {
            ProgressView(value: Double(step), total: 5).padding(.horizontal)
            Group {
                switch step {
                case 1: identityStep
                case 2: sourceStep
                case 3: DisplayGuideView()
                case 4: AutomationGuideView()
                default: ReceptionTestView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            HStack {
                if step > 1 { Button("이전") { step -= 1 } }
                Spacer()
                Button(step == 5 ? "시작하기" : "다음") {
                    guard let settings,
                          model.save(settings: settings, monthlyBudget: nil, finishOnboarding: step == 5) else { return }
                    if step < 5 { step += 1 }
                    else { Task { await model.refreshActivity() } }
                }
                .buttonStyle(.borderedProminent)
                .disabled(settings == nil || (step >= 2 && sources.isEmpty))
            }
            .padding()
        }
        .navigationTitle("AYR 시작하기 · \(step)/5")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var identityStep: some View {
        Form {
            Section("내 생활에 맞는 기준") {
                IdentityBudgetFields(identity: $identity, budget: $budget)
                Text("기본값을 사용하거나 원하는 양의 정수를 입력하세요. 나중에 변경해도 오늘 지출은 유지됩니다.")
                    .font(.footnote).foregroundStyle(.secondary)
                if settings == nil {
                    Text("기준 금액을 1~\(money(maximumMoney)) 범위의 숫자로 입력해주세요.")
                        .font(.footnote).foregroundStyle(.red)
                }
            }
        }
    }

    private var sourceStep: some View {
        Form {
            Section("결제 수단") { SourcePicker(sources: $sources) }
            Section {
                Text("실제 문자 형식을 확인한 수단만 지원합니다. 같은 결제 수단의 자동화는 하나만 만들어주세요.")
            }
        }
    }
}
