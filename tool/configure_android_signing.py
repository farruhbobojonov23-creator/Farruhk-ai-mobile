#!/usr/bin/env python3
"""Configure release signing for Flutter's generated Kotlin DSL Gradle project.
Run after flutter create. Secrets remain outside source control.
"""
from pathlib import Path
p = Path('android/app/build.gradle.kts')
if not p.exists():
    raise SystemExit('First run: flutter create . --platforms android --org com.chefttkpro')
s = p.read_text()
if 'CHEF_TTK_RELEASE_SIGNING' in s:
    print('Release signing already configured')
    raise SystemExit(0)
marker = '    buildTypes {'
if marker not in s or 'android {' not in s:
    raise SystemExit('Unsupported Android Gradle template; inspect manually')
if 'signingConfig = signingConfigs.getByName("debug")' not in s:
    raise SystemExit('Cannot locate default debug signing; inspect manually')
imports = '''// CHEF_TTK_RELEASE_SIGNING: auto-generated signing setup
import java.util.Properties
import java.io.FileInputStream

'''
properties = '''val chefTtkReleaseProperties = Properties()
val chefTtkReleaseFile = rootProject.file("key.properties")
if (!chefTtkReleaseFile.exists()) error("Missing private key.properties")
chefTtkReleaseProperties.load(FileInputStream(chefTtkReleaseFile))

'''
block = '''    signingConfigs {
        create("release") {
            storeFile = rootProject.file(chefTtkReleaseProperties["storeFile"] as String)
            storePassword = chefTtkReleaseProperties["storePassword"] as String
            keyAlias = chefTtkReleaseProperties["keyAlias"] as String
            keyPassword = chefTtkReleaseProperties["keyPassword"] as String
        }
    }
'''
s = imports + s.replace('android {', properties + 'android {', 1) \
    .replace(marker, block + marker, 1) \
    .replace('signingConfig = signingConfigs.getByName("debug")',
             'signingConfig = signingConfigs.getByName("release")')
p.write_text(s)
print('Release signing configured. Reuse this keystore for all app updates.')
