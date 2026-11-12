import { getDefaultConfig } from 'expo/metro-config';
const config = getDefaultConfig(import.meta.dirname);
// Docker's Swift build symlinks cannot be watched from Windows.
config.resolver.blockList = [...config.resolver.blockList, /[/\\]\.build(?:[/\\]|$)/];
export default config;
