import { refreshNativeHost } from "./refresh-native-host";

// Release preparation is host-local and staged. The historical macOS builder
// cross-compiled two other targets and silently replaced checked-in binaries.
// Cross output is not genuine-host evidence; promotion belongs to the release
// owner after all unchanged package/artifact gates pass.
const report = await refreshNativeHost();
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
