require File.join(File.dirname(`node --print "require.resolve('expo/package.json')"`), 'scripts/autolinking')
require File.join(File.dirname(`node --print "require.resolve('react-native/package.json')"`), 'scripts/react_native_pods')

ENV['RCT_USE_RN_DEP'] ||= '1'
ENV['RCT_USE_PREBUILT_RNCORE'] ||= '1'
ENV['EXPO_USE_PRECOMPILED_MODULES'] ||= '1'
platform :ios, '17.0'
project File.join(__dir__, 'AYR.xcodeproj')
prepare_react_native_project!

target 'AYR' do
  use_expo_modules!(providerName: 'AutolinkedExpoModulesProvider.swift')
  config = use_native_modules!([
    'node', '--no-warnings', '--eval', "require('expo/bin/autolinking')",
    'expo-modules-autolinking', 'react-native-config', '--json', '--platform', 'ios'
  ])
  use_react_native!(path: config[:reactNativePath], app_path: __dir__)
  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath], mac_catalyst_enabled: false)
  end
end
