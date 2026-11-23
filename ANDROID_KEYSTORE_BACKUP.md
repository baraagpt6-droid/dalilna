# Android release keystore — storage and backup guide

## Verified GitHub Actions secrets

The repository's Android release workflow currently reads these four repository secrets:

- `ANDROID_KEYSTORE_BASE64` — Base64-encoded original JKS/keystore file.
- `ANDROID_KEYSTORE_PASSWORD` — keystore password.
- `ANDROID_KEY_ALIAS` — signing key alias.
- `ANDROID_KEY_PASSWORD` — key password.

They are stored in GitHub at:

`baraagpt6-droid/dalilna` → Settings → Secrets and variables → Actions.

The latest Android 3.1.0 workflow successfully decoded `ANDROID_KEYSTORE_BASE64`, opened the keystore with `ANDROID_KEYSTORE_PASSWORD`, and validated `ANDROID_KEY_ALIAS` using `keytool -list`. APK signature verification also passed using the persistent signing mode.

GitHub does not reveal the stored secret values after they have been saved. The workflow can use them, but cannot display their original plaintext values back to a user. Do not put any of these values in the repository, an issue, a pull request, or a public release asset.

## Create an offline encrypted copy

Keep the original `.jks` or `.keystore` file in a secure offline location before changing any signing secret. Create an independently encrypted copy with a backup password that is different from the keystore password.

With OpenSSL installed:

```bash
openssl enc -aes-256-cbc -salt -pbkdf2 \
  -in dalilna-release.jks \
  -out dalilna-release.jks.enc
```

OpenSSL prompts for the backup encryption password. Store that password separately from the encrypted file. Keep two copies of the encrypted backup in separate secure locations.

To restore it:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in dalilna-release.jks.enc \
  -out dalilna-release-restored.jks
```

Then verify the restored file with the same alias and keystore password:

```bash
keytool -list -keystore dalilna-release-restored.jks -alias YOUR_KEY_ALIAS
```

## Release safety

- Never generate a new signing key to replace the persistent key used by published Android builds.
- Never upload a plaintext or password-protected keystore into a public GitHub release or repository.
- A successful CI signature check confirms that the current GitHub secrets can sign builds. It does not create an offline backup copy.
- Before rotating or replacing secrets, confirm that the offline encrypted backup can be restored and verified.
