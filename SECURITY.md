# SECURITY.md

## Security and Data Handling Policy

### 1. General Provisions

"Browser Security" is an extension for Chromium-based browsers (Manifest V3)
that acts as a local protection layer between a web page and the browser.

The Software has no server-side component, cloud infrastructure, or telemetry
modules. All functions are performed exclusively and locally on the User's
device in an offline mode.

### 2. Processing of Personal Data and Statistics

The Developer and/or the Company do not collect, store, process, transfer to
third parties, or otherwise use personal data and/or usage statistics of the
Software.

### 3. Data Transfer

No data leaves the User's device and no data is transmitted to the Developer
and/or the Company, or to third parties, with the exception of data that the
Software temporarily modifies (spoofs) for technical purposes and that is
objectively necessary for the correct operation of the websites visited by
the User.

### 4. Information About Visited Resources

The Developer and/or the Company do not have the technical capability and do
not obtain, record, or analyze information about the websites visited by the
User.

### 5. Information About Devices

The Developer and/or the Company do not receive or process information about
the devices on which the Software is installed, including, but not limited to,
their number, identifiers, technical characteristics, and other parameters.

### 6. Local Data Storage

The Software's settings and anonymized technical counters are stored only on
the User's device by means of the browser (chrome.storage) and are not
transmitted outside it. Confidential information — browsing history, cookies,
passwords, form data, page contents, camera and microphone data — is neither
read nor stored by the Software.

### 7. Permissions

The permissions used (storage, tabs, windows, scripting,
declarativeNetRequest, privacy, site access) are required solely to
perform the declared functions of the Software and are not used for data
collection.

### 8. Reporting Vulnerabilities

If you discover a security issue, open an issue in the repository:
https://github.com/ppvikentiy/security-browser-ex

Do not publicly disclose exploits before a fix is released. In the description,
include the extension version (the version field in manifest.json) and the
steps to reproduce.
