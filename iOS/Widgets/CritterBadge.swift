import SwiftUI

/// Small wallet critter (70x56) for the Live Activity; the same three bands as `spendingColor`.
/// Decorative: the phrase next to it already says the same thing.
struct CritterBadge: View {
    let total: Int
    let budget: Int

    private enum Band { case calm, caution, exceeded }

    private var band: Band {
        if total < budget / 2 + budget % 2 { return .calm }
        if total < budget { return .caution }
        return .exceeded
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            switch band {
            case .calm:
                shell(y: 4, height: 48)
                dot(x: 20, y: 22)
                dot(x: 42, y: 22)
                arc(x: 28, y: 32, width: 14, height: 8)
            case .caution:
                shell(y: 8, height: 44)
                dot(x: 20, y: 24)
                dot(x: 42, y: 24)
                Capsule().fill(AYRTheme.critterLine).frame(width: 14, height: 3).offset(x: 28, y: 38)
                drop(x: 56, y: 2)
            case .exceeded:
                shell(y: 24, height: 28)
                glass(x: 12)
                glass(x: 38)
                Rectangle().fill(AYRTheme.critterLine).frame(width: 8, height: 3).offset(x: 31, y: 31)
                drop(x: 56, y: 36)
            }
        }
        .frame(width: 70, height: 56, alignment: .topLeading)
        .accessibilityHidden(true)
    }

    private func shell(y: CGFloat, height: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 14)
            .fill(AYRTheme.wallet)
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(AYRTheme.critterLine, lineWidth: 3))
            .frame(width: 66, height: height)
            .offset(x: 2, y: y)
    }

    private func dot(x: CGFloat, y: CGFloat) -> some View {
        Circle().fill(AYRTheme.critterLine).frame(width: 8, height: 8).offset(x: x, y: y)
    }

    private func glass(x: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 3).fill(AYRTheme.critterLine).frame(width: 20, height: 9).offset(x: x, y: 28)
    }

    private func arc(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat) -> some View {
        Path { path in
            path.move(to: CGPoint(x: x, y: y))
            path.addQuadCurve(to: CGPoint(x: x + width, y: y), control: CGPoint(x: x + width / 2, y: y + height * 2))
        }
        .stroke(AYRTheme.critterLine, style: StrokeStyle(lineWidth: 3, lineCap: .round))
    }

    private func drop(x: CGFloat, y: CGFloat) -> some View {
        Circle().fill(AYRTheme.tear)
            .overlay(Circle().stroke(AYRTheme.critterLine, lineWidth: 1.5))
            .frame(width: 10, height: 10)
            .offset(x: x, y: y)
    }
}
