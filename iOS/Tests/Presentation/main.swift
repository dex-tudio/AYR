import AYRCore

precondition(money(0) == "0원")
precondition(money(1_234_567) == "1,234,567원")
print("PASS shared won formatting")

precondition(positiveMoney("1") == 1)
precondition(positiveMoney(String(maximumMoney)) == maximumMoney)
print("PASS positive money bounds")

for text in ["", "0", "-1", "+1", " 1", "1 ", "1,000", "1.5", "１２３", "١٢٣", String(maximumMoney + 1), String(Int.max) + "0"] {
    precondition(positiveMoney(text) == nil)
}
print("PASS invalid money input rejected")
print("Presentation checks: 3 passed")
