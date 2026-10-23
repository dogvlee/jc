// Public identifiers only. Set the address of the owner's authentication service.
// AppSecret and server credentials must never be placed in this client module.
module.exports = Object.freeze({
  apiBaseUrl: '',
  appId: 'wxba51f65eb2f643e7',
  // Must equal AGREEMENT_VERSION in pages/legal/index.js and CONSENT_VERSION in
  // server/app.js; tests/auth-integration.test.js checks all three together.
  consentVersion: '2026-10-15'
});
