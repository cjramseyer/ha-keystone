const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const rootDirectory = __dirname;
const dataDirectory = process.env.DATA_DIR || path.join(rootDirectory, '.data');
const secretsDirectory = process.env.SECRETS_DIR || path.join(dataDirectory, '.secrets');
const dataFile = path.join(dataDirectory, 'portal.json');
const authFile = path.join(dataDirectory, 'auth.json');
const sessionSecretFile = path.join(dataDirectory, 'session-secret');
const privateKeyFile = path.join(secretsDirectory, 'issuer-private.pem');
const publicKeyFile = path.join(secretsDirectory, 'issuer-public.pem');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const sessionCookie = 'keystone_session';
const sessionDurationMs = 8 * 60 * 60 * 1000;
const sessions = new Map();

function defaultLicenseOptions(trialDays = 30) {
  return [
    { id: `trial-${trialDays}`, type: 'trial', label: `${trialDays}-day trial`, length_days: trialDays },
    { id: 'pro-365', type: 'pro', label: 'Pro · 1 year', length_days: 365 }
  ];
}

function normalizeProfile(profile) {
  if (!Array.isArray(profile.license_options) || !profile.license_options.length) profile.license_options = defaultLicenseOptions(profile.trial_days || 30);
  delete profile.trial_days;
  delete profile.pro_days;
  return profile;
}

const profiles = {
  'home-assistant-companion': {
    id: 'app_profile_home_assistant_companion_v1', app_id: 'home-assistant-companion', name: 'HA Companion',
    installation_limit: 2, token_audience: 'home-assistant-companion',
    features: ['remote_access', 'advanced_automations', 'multiple_dashboards', 'long_term_statistics', 'backup_restore', 'advanced_presence'],
    plans: ['base', 'pro'], license_options: defaultLicenseOptions(30)
  },
  'home-assistant-voice': {
    id: 'app_profile_home_assistant_voice_v1', app_id: 'home-assistant-voice', name: 'HA Voice',
    installation_limit: 3, token_audience: 'home-assistant-voice',
    features: ['voice_assistant', 'conversation_history', 'backup_restore'],
    plans: ['base', 'pro'], license_options: defaultLicenseOptions(30)
  }
};

function ensureRuntimeFiles() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.mkdirSync(secretsDirectory, { recursive: true });
  if (!fs.existsSync(sessionSecretFile)) fs.writeFileSync(sessionSecretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  if (!fs.existsSync(authFile)) {
    const password = process.env.PORTAL_ADMIN_PASSWORD || 'change-me-local';
    fs.writeFileSync(authFile, JSON.stringify({ username: 'admin', name: 'Casey R.', email: 'admin@example.com', password_hash: hashPassword(password) }, null, 2), { mode: 0o600 });
    console.log(`Admin password initialized from ${process.env.PORTAL_ADMIN_PASSWORD ? 'PORTAL_ADMIN_PASSWORD' : 'change-me-local fallback'}.`);
  } else {
    const auth = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    let changed = false;
    if (!auth.username) { auth.username = 'admin'; changed = true; }
    if (!auth.name) { auth.name = 'Casey R.'; changed = true; }
    if (!auth.email) { auth.email = 'admin@example.com'; changed = true; }
    if (changed) fs.writeFileSync(authFile, JSON.stringify(auth, null, 2), { mode: 0o600 });
  }
  if (!fs.existsSync(dataFile)) {
    writeData({ customers: [], licenses: [], activations: [], audit_events: [], app_profiles: Object.values(profiles) });
  } else {
    const data = readData();
    if (!Array.isArray(data.app_profiles)) {
      data.app_profiles = Object.values(profiles);
      writeData(data);
    }
    data.app_profiles = data.app_profiles.map(normalizeProfile);
    Object.keys(profiles).forEach((appId) => { delete profiles[appId]; });
    data.app_profiles.forEach((profile) => { profiles[profile.app_id] = profile; });
    writeData(data);
  }
  if (!fs.existsSync(privateKeyFile) || !fs.existsSync(publicKeyFile)) {
    const keyPair = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(privateKeyFile, keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    fs.writeFileSync(publicKeyFile, keyPair.publicKey.export({ type: 'spki', format: 'pem' }));
    console.log(`Generated Ed25519 issuer keys in ${secretsDirectory}`);
  }
}

function readData() { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); }
function writeData(data) { fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), { mode: 0o600 }); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}
function verifyPassword(password, storedHash) {
  const [salt, expected] = storedHash.split(':');
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return expected && actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map((item) => {
    const separator = item.indexOf('=');
    return [item.slice(0, separator).trim(), decodeURIComponent(item.slice(separator + 1).trim())];
  }));
}
function createSession() {
  const id = crypto.randomBytes(32).toString('base64url');
  sessions.set(id, Date.now() + sessionDurationMs);
  return id;
}
function isAuthenticated(request) {
  const id = parseCookies(request)[sessionCookie];
  if (!id || !sessions.has(id)) return false;
  if (sessions.get(id) < Date.now()) { sessions.delete(id); return false; }
  return true;
}
function sendJson(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(body));
}
function sendError(response, statusCode, message) { sendJson(response, statusCode, { error: message }); }
function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; if (body.length > 1024 * 1024) reject(new Error('Request body too large')); });
    request.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Request body must be valid JSON')); } });
    request.on('error', reject);
  });
}
function publicKeyFromInput(value) {
  const encoded = typeof value === 'object' && value !== null ? value.value : value;
  if (typeof encoded !== 'string' || !encoded.trim()) throw new Error('Activation request is missing its public key');
  if (typeof value === 'object' && value.algorithm && value.algorithm !== 'Ed25519') throw new Error('Activation public key algorithm must be Ed25519');
  if (typeof value === 'object' && value.encoding && value.encoding !== 'base64url') throw new Error('Activation public key encoding must be base64url');
  if (encoded.includes('BEGIN PUBLIC KEY')) return crypto.createPublicKey(encoded);
  const keyBytes = Buffer.from(encoded, 'base64url');
  if (keyBytes.length === 32) {
    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
    return crypto.createPublicKey({ key: Buffer.concat([spkiPrefix, keyBytes]), type: 'spki', format: 'der' });
  }
  return crypto.createPublicKey({ key: keyBytes, type: 'spki', format: 'der' });
}
function activationMessage(request) { return `${request.app_id}.${request.instance_id}.${request.instance_key_id}.${request.nonce}`; }
function verifyActivationRequest(request) {
  const required = ['app_id', 'instance_id', 'instance_key_id', 'nonce', 'signature', 'instance_public_key'];
  if (required.some((field) => request[field] === undefined || request[field] === null || (typeof request[field] === 'string' && !request[field].trim()))) throw new Error('Activation request is missing required instance proof fields');
  const publicKey = publicKeyFromInput(request.instance_public_key);
  const signatureValue = typeof request.signature === 'object' && request.signature !== null ? request.signature.value : request.signature;
  if (typeof signatureValue !== 'string' || !signatureValue.trim()) throw new Error('Activation request is missing its signature');
  if (typeof request.signature === 'object' && request.signature.algorithm && request.signature.algorithm !== 'Ed25519') throw new Error('Activation signature algorithm must be Ed25519');
  const valid = crypto.verify(null, Buffer.from(activationMessage(request)), publicKey, Buffer.from(signatureValue, 'base64url'));
  if (!valid) throw new Error('Instance proof signature is invalid');
  return crypto.createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('base64url');
}
function signLicense(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'license+jwt', kid: 'issuer-ed25519-01' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${header}.${body}`;
  const signature = crypto.sign(null, Buffer.from(signingInput), fs.readFileSync(privateKeyFile)).toString('base64url');
  return `${signingInput}.${signature}`;
}
function verifyLicenseToken(token) {
  const [header, body, signature] = String(token || '').split('.');
  if (!header || !body || !signature) throw new Error('Malformed license token');
  const publicKey = crypto.createPublicKey(fs.readFileSync(publicKeyFile));
  if (!crypto.verify(null, Buffer.from(`${header}.${body}`), publicKey, Buffer.from(signature, 'base64url'))) throw new Error('License signature is invalid');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.aud !== profiles[payload.app_id]?.token_audience || Date.parse(payload.expires_at) <= Date.now()) throw new Error('License audience or expiration is invalid');
  const storedLicense = readData().licenses.find((license) => license.license_id === payload.license_id);
  if (storedLicense?.status === 'revoked') throw new Error('License has been revoked');
  return payload;
}
function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function safeLicense(license) { const { token, license_payload, activation_request, ...metadata } = license; return metadata; }
function legacyLicensePayload(license) { return { version: license.version, license_id: license.license_id, app_id: license.app_id, profile_id: license.profile_id, customer_id: license.customer_id, aud: license.aud, instance_binding: license.instance_binding, option_id: license.option_id, option_type: license.option_type, option_length_days: license.option_length_days, plan: license.plan, license_type: license.license_type, features: license.features, issued_at: license.issued_at, expires_at: license.expires_at, installation_limit: license.installation_limit, key_id: license.key_id }; }
function storedLicensePayload(license) { return license.license_payload ? JSON.parse(JSON.stringify(license.license_payload)) : legacyLicensePayload(license); }
function calculateMetrics(data) {
  const now = Date.now();
  const validLicenses = data.licenses.filter((license) => license.status !== 'revoked' && Date.parse(license.expires_at) > now);
  const paidLicenses = data.licenses.filter((license) => license.license_type === 'paid' || license.option_type === 'pro');
  const renewedLicenseIds = new Set(data.audit_events.filter((event) => event.action === 'license.renewed').map((event) => event.license_id));
  return {
    active_licenses: validLicenses.length,
    trials_in_progress: validLicenses.filter((license) => license.license_type === 'trial' || license.option_type === 'trial').length,
    renewal_rate: paidLicenses.length ? Number(((paidLicenses.filter((license) => renewedLicenseIds.has(license.license_id)).length / paidLicenses.length) * 100).toFixed(1)) : 0
  };
}
function serveStatic(request, response) {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(rootDirectory, requested);
  if (!filePath.startsWith(rootDirectory) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendError(response, 404, 'Not found');
  const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
  response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(response);
}

async function handleApi(request, response) {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (request.method === 'GET' && pathname === '/api/health') return sendJson(response, 200, { ok: true, issuer: 'ed25519', persistence: 'json' });
  if (request.method === 'POST' && pathname === '/api/auth/login') {
    const body = await readBody(request);
    const storedAuth = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    if (body.email !== 'admin' || typeof body.password !== 'string' || !verifyPassword(body.password, storedAuth.password_hash)) return sendError(response, 401, 'Invalid administrator credentials');
    const session = createSession();
    return sendJson(response, 200, { authenticated: true }, { 'Set-Cookie': `${sessionCookie}=${encodeURIComponent(session)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800` });
  }
  if (request.method === 'POST' && pathname === '/api/auth/logout') {
    const session = parseCookies(request)[sessionCookie];
    if (session) sessions.delete(session);
    return sendJson(response, 200, { authenticated: false }, { 'Set-Cookie': `${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
  }
  if (request.method === 'GET' && pathname === '/api/auth/session') {
    const authenticated = isAuthenticated(request);
    const auth = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    return sendJson(response, 200, { authenticated, profile: authenticated ? { username: auth.username, name: auth.name, email: auth.email } : null });
  }
  if (!isAuthenticated(request)) return sendError(response, 401, 'Administrator authentication required');
  if (request.method === 'GET' && pathname === '/api/issuer/public-key') {
    return sendJson(response, 200, { key_id: 'issuer-ed25519-01', algorithm: 'Ed25519', public_key_pem: fs.readFileSync(publicKeyFile, 'utf8') });
  }
  if (request.method === 'PUT' && pathname === '/api/auth/profile') {
    const body = await readBody(request);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(response, 400, 'A display name and valid email are required');
    const auth = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    auth.name = name;
    auth.email = email;
    fs.writeFileSync(authFile, JSON.stringify(auth, null, 2), { mode: 0o600 });
    const data = readData();
    data.audit_events.push({ id: id('audit'), actor: auth.username || 'admin', action: 'admin.profile.updated', created_at: new Date().toISOString() });
    writeData(data);
    return sendJson(response, 200, { profile: { username: auth.username, name: auth.name, email: auth.email } });
  }
  if (request.method === 'GET' && pathname === '/api/state') {
    const data = readData();
    return sendJson(response, 200, { profiles: Object.values(profiles), customers: data.customers, licenses: data.licenses.map(safeLicense), audit_events: data.audit_events.slice(-20).reverse(), metrics: calculateMetrics(data) });
  }
  const licenseRenewMatch = pathname.match(/^\/api\/licenses\/([^/]+)\/renew$/);
  if (request.method === 'POST' && licenseRenewMatch) {
    const licenseId = decodeURIComponent(licenseRenewMatch[1]);
    const data = readData();
    const license = data.licenses.find((record) => record.license_id === licenseId);
    if (!license) return sendError(response, 404, 'License not found');
    if (license.status === 'revoked') return sendError(response, 409, 'Revoked licenses cannot be renewed');
    const extensionDays = Number(license.option_length_days || 365);
    const currentExpiry = Math.max(Date.now(), Date.parse(license.expires_at));
    const renewedUntil = new Date(currentExpiry + extensionDays * 86400000).toISOString();
    license.expires_at = renewedUntil;
    if (license.license_payload) license.license_payload.expires_at = renewedUntil;
    license.updated_at = new Date().toISOString();
    data.audit_events.push({ id: id('audit'), actor: 'admin', action: 'license.renewed', license_id: licenseId, customer_id: license.customer_id, metadata: { extension_days: extensionDays }, created_at: license.updated_at });
    writeData(data);
    return sendJson(response, 200, { license: safeLicense(license) });
  }
  const licenseReissueMatch = pathname.match(/^\/api\/licenses\/([^/]+)\/reissue$/);
  if (request.method === 'POST' && licenseReissueMatch) {
    const licenseId = decodeURIComponent(licenseReissueMatch[1]);
    const data = readData();
    const license = data.licenses.find((record) => record.license_id === licenseId);
    if (!license) return sendError(response, 404, 'License not found');
    if (license.status === 'revoked' || Date.parse(license.expires_at) <= Date.now()) return sendError(response, 409, 'Only active, unexpired licenses can be reissued');
    const payload = storedLicensePayload(license);
    const token = signLicense(payload);
    license.token_hash = crypto.createHash('sha256').update(token).digest('hex');
    license.updated_at = new Date().toISOString();
    data.audit_events.push({ id: id('audit'), actor: 'admin', action: 'license.reissued', license_id: licenseId, customer_id: license.customer_id, created_at: license.updated_at });
    writeData(data);
    return sendJson(response, 200, { license: safeLicense(license), token });
  }
  const licenseRevokeMatch = pathname.match(/^\/api\/licenses\/([^/]+)\/revoke$/);
  if (request.method === 'POST' && licenseRevokeMatch) {
    const licenseId = decodeURIComponent(licenseRevokeMatch[1]);
    const data = readData();
    const license = data.licenses.find((record) => record.license_id === licenseId);
    if (!license) return sendError(response, 404, 'License not found');
    if (license.status === 'revoked') return sendJson(response, 200, { license: safeLicense(license), already_revoked: true });
    const now = new Date().toISOString();
    license.status = 'revoked';
    license.revoked_at = now;
    license.updated_at = now;
    data.audit_events.push({ id: id('audit'), actor: 'admin', action: 'license.revoked', license_id: licenseId, customer_id: license.customer_id, created_at: now });
    writeData(data);
    return sendJson(response, 200, { license: safeLicense(license) });
  }
  const customerDeleteMatch = pathname.match(/^\/api\/customers\/([^/]+)$/);
  if (request.method === 'DELETE' && customerDeleteMatch) {
    const customerId = decodeURIComponent(customerDeleteMatch[1]);
    const data = readData();
    const customer = data.customers.find((record) => record.id === customerId);
    if (!customer) return sendError(response, 404, 'Customer not found');
    if (data.licenses.some((license) => license.customer_id === customerId && license.status !== 'revoked')) return sendError(response, 409, 'Customer cannot be deleted while active licenses reference it');
    data.customers = data.customers.filter((record) => record.id !== customerId);
    data.audit_events.push({ id: id('audit'), actor: 'admin', action: 'customer.deleted', customer_id: customerId, created_at: new Date().toISOString() });
    writeData(data);
    return sendJson(response, 200, { deleted: customerId });
  }
  if (request.method === 'POST' && pathname === '/api/customers') {
    const body = await readBody(request);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(response, 400, 'A customer name and valid email are required');
    const data = readData();
    if (data.customers.some((customer) => customer.email.toLowerCase() === email)) return sendError(response, 409, 'A customer with this email already exists');
    const customer = { id: id('cust'), name, email, created_at: new Date().toISOString() };
    data.customers.push(customer);
    data.audit_events.push({ id: id('audit'), actor: 'admin', action: 'customer.created', customer_id: customer.id, created_at: new Date().toISOString() });
    writeData(data);
    return sendJson(response, 201, { customer });
  }
  if (request.method === 'POST' && pathname === '/api/app-profiles') {
    const body = await readBody(request);
    const appId = String(body.app_id || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const plans = Array.isArray(body.plans) && body.plans.length ? body.plans.map((plan) => String(plan).toLowerCase()) : ['base', 'pro'];
    const features = Array.isArray(body.features) ? body.features.map(String) : [];
    const installationLimit = Number(body.installation_limit || 1);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(appId) || !name || profiles[appId]) return sendError(response, 400, 'Profile ID must be unique, lowercase, and use hyphens only');
    if (!Number.isInteger(installationLimit) || installationLimit < 1) return sendError(response, 400, 'Installation limit must be a positive whole number');
    const profile = { id: id('app_profile'), app_id: appId, name, installation_limit: installationLimit, token_audience: String(body.token_audience || appId), features, plans, license_options: [] };
    const data = readData();
    profiles[appId] = profile;
    data.app_profiles.push(profile);
    data.audit_events.push({ id: id('audit'), actor: 'admin', action: 'app_profile.created', app_profile_id: profile.id, created_at: new Date().toISOString() });
    writeData(data);
    return sendJson(response, 201, { profile });
  }
  const profileUpdateMatch = pathname.match(/^\/api\/app-profiles\/([^/]+)$/);
  if (request.method === 'PUT' && profileUpdateMatch) {
    const appId = decodeURIComponent(profileUpdateMatch[1]);
    const profile = profiles[appId];
    if (!profile) return sendError(response, 404, 'Application profile not found');
    const body = await readBody(request);
    const name = String(body.name || profile.name).trim();
    const installationLimit = Number(body.installation_limit || profile.installation_limit);
    const features = Array.isArray(body.features) ? body.features.map(String) : profile.features;
    if (!name || !Number.isInteger(installationLimit) || installationLimit < 1) return sendError(response, 400, 'Profile name and installation limit are required');
    const data = readData();
    Object.assign(profile, { name, installation_limit: installationLimit, features, updated_at: new Date().toISOString() });
    data.app_profiles = data.app_profiles.map((record) => record.app_id === appId ? profile : record);
    data.audit_events.push({ id: id('audit'), actor: 'admin', action: 'app_profile.updated', app_profile_id: profile.id, created_at: new Date().toISOString() });
    writeData(data);
    return sendJson(response, 200, { profile });
  }
  const profileOptionMatch = pathname.match(/^\/api\/app-profiles\/([^/]+)\/license-options(?:\/([^/]+))?$/);
  if (profileOptionMatch && request.method === 'POST' && !profileOptionMatch[2]) {
    const appId = decodeURIComponent(profileOptionMatch[1]);
    const profile = profiles[appId];
    if (!profile) return sendError(response, 404, 'Application profile not found');
    const body = await readBody(request);
    const type = String(body.type || '').trim().toLowerCase();
    const lengthDays = Number(body.length_days);
    const label = String(body.label || `${type} · ${lengthDays} days`).trim();
    if (!['trial', 'pro', 'base'].includes(type) || !Number.isInteger(lengthDays) || lengthDays < 1 || !label) return sendError(response, 400, 'Option type, label, and a positive whole-day length are required');
    normalizeProfile(profile);
    if (profile.license_options.some((option) => option.type === type && option.length_days === lengthDays)) return sendError(response, 409, 'This license option already exists');
    const option = { id: `${type}-${lengthDays}-${crypto.randomBytes(3).toString('hex')}`, type, label, length_days: lengthDays };
    profile.license_options.push(option);
    const data = readData();
    data.app_profiles = data.app_profiles.map((record) => record.app_id === appId ? profile : record);
    data.audit_events.push({ id: id('audit'), actor: 'admin', action: 'license_option.created', app_profile_id: profile.id, metadata: { option_id: option.id }, created_at: new Date().toISOString() });
    writeData(data);
    return sendJson(response, 201, { option });
  }
  if (profileOptionMatch && request.method === 'DELETE' && profileOptionMatch[2]) {
    const appId = decodeURIComponent(profileOptionMatch[1]);
    const optionId = decodeURIComponent(profileOptionMatch[2]);
    const profile = profiles[appId];
    if (!profile) return sendError(response, 404, 'Application profile not found');
    normalizeProfile(profile);
    const data = readData();
    if (!profile.license_options.some((option) => option.id === optionId)) return sendError(response, 404, 'License option not found');
    if (data.licenses.some((license) => license.app_id === appId && license.option_id === optionId && license.status !== 'revoked')) return sendError(response, 409, 'License option cannot be removed while active licenses reference it');
    profile.license_options = profile.license_options.filter((option) => option.id !== optionId);
    data.app_profiles = data.app_profiles.map((record) => record.app_id === appId ? profile : record);
    data.audit_events.push({ id: id('audit'), actor: 'admin', action: 'license_option.deleted', app_profile_id: profile.id, metadata: { option_id: optionId }, created_at: new Date().toISOString() });
    writeData(data);
    return sendJson(response, 200, { deleted: optionId });
  }
  const profileDeleteMatch = pathname.match(/^\/api\/app-profiles\/([^/]+)$/);
  if (request.method === 'DELETE' && profileDeleteMatch) {
    const appId = decodeURIComponent(profileDeleteMatch[1]);
    if (!profiles[appId]) return sendError(response, 404, 'Application profile not found');
    const data = readData();
    if (data.licenses.some((license) => license.app_id === appId && license.status !== 'revoked')) return sendError(response, 409, 'Profile cannot be deleted while active licenses reference it');
    delete profiles[appId];
    data.app_profiles = data.app_profiles.filter((profile) => profile.app_id !== appId);
    data.audit_events.push({ id: id('audit'), actor: 'admin', action: 'app_profile.deleted', app_id: appId, created_at: new Date().toISOString() });
    writeData(data);
    return sendJson(response, 200, { deleted: appId });
  }
  if (request.method === 'POST' && pathname === '/api/licenses/issue') {
    const body = await readBody(request);
    const profile = profiles[String(body.app_id || '').toLowerCase()];
    const option = profile && (normalizeProfile(profile).license_options.find((candidate) => candidate.id === body.option_id) || normalizeProfile(profile).license_options.find((candidate) => candidate.type === body.license_type && (candidate.type === 'pro' ? body.plan === 'pro' : true)));
    if (!profile || !option) return sendError(response, 400, 'Application profile or license option is invalid');
    const data = readData();
    const selectedCustomer = body.customer_id ? data.customers.find((customer) => customer.id === body.customer_id) : null;
    if (body.customer_id && !selectedCustomer) return sendError(response, 400, 'Selected customer was not found');
    const customerName = selectedCustomer?.name || body.customer_name;
    const customerEmail = selectedCustomer?.email || body.customer_email;
    if (!customerName || !customerEmail || !body.instance_value) return sendError(response, 400, 'Customer and instance information are required');
    let instanceHash;
    try { instanceHash = verifyActivationRequest({ ...body.activation_request, app_id: profile.app_id }); } catch (error) { return sendError(response, 400, error.message); }
    const now = new Date();
    const durationDays = option.length_days;
    const expires = new Date(now.getTime() + durationDays * 86400000);
    const licenseId = id('lic');
    const existingCustomer = selectedCustomer || data.customers.find((customer) => customer.email.toLowerCase() === String(customerEmail).trim().toLowerCase());
    const customerId = existingCustomer?.id || id('cust');
    const payload = { version: 1, license_id: licenseId, app_id: profile.app_id, profile_id: profile.id, customer_id: customerId, aud: profile.token_audience, instance_binding: { instance_value: body.instance_value, instance_key_id: body.activation_request.instance_key_id, instance_public_key_sha256: instanceHash }, option_id: option.id, option_type: option.type, option_length_days: option.length_days, plan: option.type, license_type: option.type, features: option.type === 'pro' ? profile.features : [], issued_at: now.toISOString(), expires_at: expires.toISOString(), installation_limit: profile.installation_limit, key_id: 'issuer-ed25519-01' };
    const token = signLicense(payload);
    const activationRequest = JSON.parse(JSON.stringify({ ...body.activation_request, app_id: profile.app_id }));
    if (!existingCustomer) data.customers.push({ id: customerId, name: customerName, email: customerEmail, created_at: now.toISOString() });
    data.licenses.push({ ...payload, license_payload: JSON.parse(JSON.stringify(payload)), activation_request: activationRequest, status: 'active', token_hash: crypto.createHash('sha256').update(token).digest('hex'), created_at: now.toISOString(), updated_at: now.toISOString() });
    data.audit_events.push({ id: id('audit'), actor: 'admin', action: 'license.issued', license_id: licenseId, customer_id: customerId, created_at: now.toISOString() });
    writeData(data);
    return sendJson(response, 201, { license: safeLicense(payload), token });
  }
  if (request.method === 'POST' && pathname === '/api/licenses/verify') {
    const body = await readBody(request);
    try { return sendJson(response, 200, { valid: true, claims: verifyLicenseToken(body.token) }); } catch (error) { return sendError(response, 400, error.message); }
  }
  return sendError(response, 404, 'API route not found');
}

ensureRuntimeFiles();
const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith('/api/')) await handleApi(request, response);
    else if (request.method === 'GET') serveStatic(request, response);
    else sendError(response, 405, 'Method not allowed');
  } catch (error) { console.error(error); if (!response.headersSent) sendError(response, 500, 'Unexpected server error'); }
});
server.listen(port, host, () => console.log(`Keystone portal running at http://${host}:${port}`));