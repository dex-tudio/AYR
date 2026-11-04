import Foundation
import AYRCore

func money(_ value: Int) -> String {
    value.formatted(.number.locale(Locale(identifier: "ko_KR"))) + "원"
}

func positiveMoney(_ text: String) -> Int? {
    guard !text.isEmpty, text.allSatisfy({ $0.isASCII && $0.isNumber }),
          let value = Int(text), value > 0, value <= maximumMoney else { return nil }
    return value
}
