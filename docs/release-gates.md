# Product release gates

Source availability is separate from readiness to operate a hosted application.

| Gate | Current boundary |
| --- | --- |
| Code/test/build/security checks | Verify the exact candidate with bin/ci; remote CI is separate evidence |
| Content integrity | Manifests, registries and mirrors must agree on versions and digests |
| Source rights | Record asset-level rights and locators; a validator does not grant permission |
| Domain review | Owner approval is not independent review; source packets still record pending independent review |
| Accessibility | Automated browser checks exist; manual assistive-technology review remains open |
| Learning outcomes | No target-user study or improvement guarantee is established |
| Accounts/privacy | Local auth/profile/export/deletion exist; production import remains disabled |
| Production operations | Operator must verify revision, HTTPS, persistent storage, backup/restore and monitoring |
| External providers | Mail delivery, analytics configuration and any future payment gates need separate verification |

Do not silently promote content to satisfy a gate. Record actual results and
remaining limits. See [releasing](releasing.md) and [self-hosting](deployment-plan.md).
