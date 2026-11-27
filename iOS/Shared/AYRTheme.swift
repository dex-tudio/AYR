import SwiftUI
import UIKit

enum AYRTheme {
    static let ink = Color(red: 17 / 255, green: 17 / 255, blue: 17 / 255)
    static let lime = Color(red: 255 / 255, green: 212 / 255, blue: 59 / 255)
    static let background = adaptive(light: 0xEDE6FF, dark: 0x17151F)
    static let surface = adaptive(light: 0xFFFFFF, dark: 0x23202E)
    static let text = adaptive(light: 0x111111, dark: 0xF4F2FA)
    static let secondary = adaptive(light: 0x4A4658, dark: 0xB9B4C8)
    static let accent = adaptive(light: 0x6C3BFF, dark: 0xB49BFF)
    static let calm = adaptive(light: 0x1E7A3A, dark: 0x7FE39A)
    static let caution = adaptive(light: 0x8A5A00, dark: 0xFFD43B)
    static let exceeded = adaptive(light: 0xC2321F, dark: 0xFF8A73)
    static let moodCalm = adaptive(light: 0xBDF2C9, dark: 0x123A22)
    static let moodCaution = adaptive(light: 0xFFD43B, dark: 0x4A3A00)
    static let moodExceeded = adaptive(light: 0xFF6A4D, dark: 0x4A150D)
    static let moodInk = adaptive(light: 0x111111, dark: 0xF5F5F0)
    static let wallet = adaptive(light: 0x6C3BFF, dark: 0x6C3BFF)
    static let critterLine = adaptive(light: 0x111111, dark: 0x111111)
    static let bill = adaptive(light: 0x5AD678, dark: 0x5AD678)
    static let tear = adaptive(light: 0x4FB6FF, dark: 0x4FB6FF)
    static let gold = adaptive(light: 0xFFC400, dark: 0xFFC400)
    /// Black Han Sans PostScript name; bundled through UIAppFonts in both targets.
    static let display = "BlackHanSans-Regular"

    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 255) / 255,
                           green: CGFloat((hex >> 8) & 255) / 255,
                           blue: CGFloat(hex & 255) / 255, alpha: 1)
        })
    }
}

func spendingColor(total: Int, budget: Int) -> Color {
    if total < budget / 2 + budget % 2 { return AYRTheme.calm }
    if total < budget { return AYRTheme.caution }
    return AYRTheme.exceeded
}

/// Background color for the today screen; same band boundaries as `spendingColor`.
extension AYRTheme {
    static func mood(total: Int, budget: Int) -> Color {
        if total < budget / 2 + budget % 2 { return moodCalm }
        if total < budget { return moodCaution }
        return moodExceeded
    }
}
