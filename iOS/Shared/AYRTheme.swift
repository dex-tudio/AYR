import SwiftUI
import UIKit

enum AYRTheme {
    static let ink = Color(red: 37 / 255, green: 43 / 255, blue: 32 / 255)
    static let lime = Color(red: 213 / 255, green: 245 / 255, blue: 107 / 255)
    static let background = adaptive(light: 0xF7F5EE, dark: 0x1C2019)
    static let surface = adaptive(light: 0xFFFFFF, dark: 0x2A3024)
    static let text = adaptive(light: 0x252B20, dark: 0xF2F3E9)
    static let secondary = adaptive(light: 0x626A59, dark: 0xB6BDAA)
    static let accent = adaptive(light: 0x40531B, dark: 0xD5F56B)
    static let calm = adaptive(light: 0x24643D, dark: 0x9AD8AB)
    static let caution = adaptive(light: 0x875000, dark: 0xFFD18A)
    static let exceeded = adaptive(light: 0xAC353D, dark: 0xFFA4A2)

    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 255) / 255,
                           green: CGFloat((hex >> 8) & 255) / 255,
                           blue: CGFloat(hex & 255) / 255, alpha: 1)
        })
    }
}

extension View {
    func ayrScreen() -> some View {
        scrollContentBackground(.hidden)
            .background(AYRTheme.background)
            .foregroundStyle(AYRTheme.text)
    }

    func ayrCard() -> some View {
        frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(AYRTheme.surface, in: RoundedRectangle(cornerRadius: 24))
    }
}

struct AYRPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(AYRTheme.ink)
            .frame(maxWidth: .infinity, minHeight: 44)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(AYRTheme.lime, in: RoundedRectangle(cornerRadius: 18))
            .opacity(enabled ? (configuration.isPressed ? 0.75 : 1) : 0.4)
    }
}

func spendingColor(total: Int, budget: Int) -> Color {
    if total < budget / 2 + budget % 2 { return AYRTheme.calm }
    if total < budget { return AYRTheme.caution }
    return AYRTheme.exceeded
}
