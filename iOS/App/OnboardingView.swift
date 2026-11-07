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
            VStack(alignment: .leading, spacing: 12) {
                Text("AYR / 시작하기").font(.caption.bold()).foregroundStyle(.secondary)
                Text(["내 소비의 기준부터.", "어떻게 결제하나요?", "잠금화면에서 만나요.", "문자가 오면, 자동으로.", "이제 연결을 확인해요."][step - 1])
                    .font(.system(.title, design: .rounded, weight: .black))
                    .fixedSize(horizontal: false, vertical: true)
                ProgressView(value: Double(step), total: 5)
                    .tint(AYRTheme.accent)
                    .accessibilityLabel("설정 진행")
                    .accessibilityValue("5단계 중 \(step)단계")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
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
                if step > 1 {
                    Button("이전") { step -= 1 }
                        .frame(minWidth: 44, minHeight: 44)
                        .padding(.trailing, 12)
                }
                Button(step == 5 ? "시작하기" : "다음") {
                    guard let settings,
                          model.save(settings: settings, monthlyBudget: nil, finishOnboarding: step == 5) else { return }
                    if step < 5 { step += 1 }
                    else { Task { await model.refreshActivity() } }
                }
                .buttonStyle(AYRPrimaryButtonStyle())
                .disabled(settings == nil || (step >= 2 && sources.isEmpty))
            }
            .padding(20)
        }
        .ayrScreen()
        .navigationTitle("AYR 시작하기 · \(step)/5")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var identityStep: some View {
        Form {
            Section("내 생활에 맞는 기준") {
                IdentityBudgetFields(identity: $identity, budget: $budget)
                Text("하루에 이 정도면 적당하겠다 싶은 금액을 정해주세요. 나중에 바꿔도 오늘 쓴 돈은 그대로예요.")
                    .font(.footnote).foregroundStyle(.secondary)
                if settings == nil {
                    Text("하루 기준은 1~\(money(maximumMoney)) 사이의 숫자로 적어주세요.")
                        .font(.footnote).foregroundStyle(.red)
                }
            }
        }
        .ayrScreen()
    }

    private var sourceStep: some View {
        Form {
            Section("결제 수단") { SourcePicker(sources: $sources) }
            Section {
                Text("지금은 KB국민 체크카드 문자를 연결할 수 있어요. 같은 결제가 두 번 더해지지 않도록 자동화는 하나만 만들어주세요.")
            }
        }
        .ayrScreen()
    }
}
