import ExpoModulesCore

@objc(ExpoModulesProvider)
final class ExpoModulesProvider: AutolinkedExpoModulesProvider {
    override func getModuleClasses() -> [ExpoModuleTupleType] {
        super.getModuleClasses() + [(module: AYRModule.self, name: nil)]
    }
}
