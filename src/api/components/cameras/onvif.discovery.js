'use-strict';

import http from 'http';
import crypto from 'crypto';
import net from 'net';
import os from 'os';

const DEFAULT_PORTS = [8888, 8899, 5000, 8080, 80];
const DEFAULT_PORT_SET = new Set(DEFAULT_PORTS);
const ONVIF_PATHS = ['/onvif/device_service', '/onvif/device_service/', '/onvif/Device', '/onvif/device'];
const REQUEST_TIMEOUT = 650;
const DISCOVERY_CONCURRENCY = 160;

const inputError = (message) => Object.assign(new Error(message), { statusCode: 400 });

const envelope = (body) =>
  `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>${body}</s:Body></s:Envelope>`;

const getSystemDateAndTimeBody = envelope(
  '<GetSystemDateAndTime xmlns="http://www.onvif.org/ver10/device/wsdl"/>'
);
const getDeviceInformationBody = envelope(
  '<GetDeviceInformation xmlns="http://www.onvif.org/ver10/device/wsdl"/>'
);
const getProfilesBody = envelope('<GetProfiles xmlns="http://www.onvif.org/ver10/media/wsdl"/>');

const toInteger = (ip) =>
  ip.split('.').reduce((result, octet) => (result << 8) + Number.parseInt(octet, 10), 0) >>> 0;

const fromInteger = (integer) =>
  [24, 16, 8, 0].map((shift) => (integer >>> shift) & 255).join('.');

const isPrivateCameraIp = (ip) => {
  if (net.isIP(ip) !== 4) {
    return false;
  }

  const [first, second] = ip.split('.').map((part) => Number.parseInt(part, 10));

  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
};

const normalizePorts = (ports = DEFAULT_PORTS) => {
  const normalized = [...new Set(ports.map((port) => Number.parseInt(port, 10)).filter((port) => DEFAULT_PORT_SET.has(port)))];

  return normalized.length ? normalized : DEFAULT_PORTS;
};

const prefixFromNetmask = (netmask) =>
  netmask
    .split('.')
    .map((octet) => Number.parseInt(octet, 10).toString(2).padStart(8, '0'))
    .join('')
    .split('1').length - 1;

const tagValue = (xml, tag) => {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'i'));
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
};

const attributeValues = (xml, tag, attribute) =>
  [...xml.matchAll(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*\\b${attribute}=["']([^"']+)["']`, 'gi'))].map(
    (match) => match[1]
  );

const redactUri = (uri) =>
  uri
    .replace(/(rtsp:\/\/[^:/@]+:)[^@]+@/i, '$1***@')
    .replace(/(password=)[^_&?\s/]+/gi, '$1***')
    .replace(/(pwd=)[^_&?\s/]+/gi, '$1***')
    .replace(/(pass=)[^_&?\s/]+/gi, '$1***');

const escapeXml = (value) =>
  `${value || ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const md5 = (value) => crypto.createHash('md5').update(value).digest('hex');

const createWsSecurityHeader = ({ username = '', password = '' }) => {
  const nonce = crypto.randomBytes(16);
  const created = new Date().toISOString();
  const passwordDigest = crypto
    .createHash('sha1')
    .update(Buffer.concat([nonce, Buffer.from(created), Buffer.from(password)]))
    .digest('base64');

  return `<s:Header><wsse:Security s:mustUnderstand="1" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"><wsse:UsernameToken><wsse:Username>${escapeXml(
    username
  )}</wsse:Username><wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${passwordDigest}</wsse:Password><wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce.toString(
    'base64'
  )}</wsse:Nonce><wsu:Created>${created}</wsu:Created></wsse:UsernameToken></wsse:Security></s:Header>`;
};

const withSoapSecurity = (body, credentials = {}) => {
  if (!credentials.username && !credentials.password) {
    return body;
  }

  return body.replace('<s:Body>', `${createWsSecurityHeader(credentials)}<s:Body>`);
};

const parseAuthenticateHeader = (header) => {
  const challenge = Array.isArray(header) ? header[0] : header || '';
  const scheme = challenge.match(/^\s*(\w+)/)?.[1]?.toLowerCase() || '';
  const params = {};

  for (const match of challenge.matchAll(/(\w+)=("([^"]*)"|([^,]*))/g)) {
    params[match[1].toLowerCase()] = match[3] || match[4] || '';
  }

  return {
    scheme,
    params,
  };
};

const createAuthorizationHeader = (challenge, method, path, { username = '', password = '' }) => {
  const { scheme, params } = parseAuthenticateHeader(challenge);

  if (!scheme) {
    return '';
  }

  if (scheme === 'basic') {
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  if (scheme !== 'digest' || !params.realm || !params.nonce) {
    return '';
  }

  const qop = (params.qop || '')
    .split(',')
    .map((item) => item.trim())
    .find((item) => item === 'auth');
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');
  const algorithm = (params.algorithm || 'MD5').toUpperCase();
  const ha1Base = md5(`${username}:${params.realm}:${password}`);
  const ha1 = algorithm === 'MD5-SESS' ? md5(`${ha1Base}:${params.nonce}:${cnonce}`) : ha1Base;
  const ha2 = md5(`${method}:${path}`);
  const response = qop ? md5(`${ha1}:${params.nonce}:${nc}:${cnonce}:${qop}:${ha2}`) : md5(`${ha1}:${params.nonce}:${ha2}`);
  const parts = [
    `username="${username}"`,
    `realm="${params.realm}"`,
    `nonce="${params.nonce}"`,
    `uri="${path}"`,
    `response="${response}"`,
  ];

  if (params.opaque) {
    parts.push(`opaque="${params.opaque}"`);
  }

  if (params.algorithm) {
    parts.push(`algorithm=${params.algorithm}`);
  }

  if (qop) {
    parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  }

  return `Digest ${parts.join(', ')}`;
};

const isOnvifResponse = (response) => {
  const haystack = `${response.status || ''} ${response.server || ''} ${response.data || ''}`;
  return /onvif|SOAP|Envelope|GetSystemDateAndTime|Unauthorized|Authentication|ter:|tds:/i.test(haystack);
};

const sendOnvif = (host, port, path, body, authorization = '') =>
  new Promise((resolve) => {
    const headers = {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    };

    if (authorization) {
      headers.Authorization = authorization;
    }

    const request = http.request(
      {
        host,
        port,
        path,
        method: 'POST',
        timeout: REQUEST_TIMEOUT,
        headers,
      },
      (response) => {
        let data = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            server: response.headers.server || '',
            headers: response.headers || {},
            data,
          })
        );
      }
    );

    request.on('timeout', () => {
      request.destroy();
      resolve({ error: 'timeout', data: '' });
    });
    request.on('error', (error) => resolve({ error: error.message, data: '' }));
    request.write(body);
    request.end();
  });

const requestOnvif = async (host, port, path, body, credentials = {}) => {
  const authenticatedBody = withSoapSecurity(body, credentials);
  const response = await sendOnvif(host, port, path, authenticatedBody);

  if (response.status !== 401 || (!credentials.username && !credentials.password)) {
    return response;
  }

  const authorization = createAuthorizationHeader(response.headers?.['www-authenticate'], 'POST', path, credentials);

  if (!authorization) {
    return response;
  }

  return sendOnvif(host, port, path, authenticatedBody, authorization);
};

const getDhcpLanScanTargets = () => {
  const hosts = new Set();
  const networks = [];

  for (const [name, interfaces] of Object.entries(os.networkInterfaces())) {
    for (const network of interfaces || []) {
      if (network.family !== 'IPv4' || network.internal) {
        continue;
      }

      if (!isPrivateCameraIp(network.address)) {
        continue;
      }

      const prefix = network.cidr ? Number.parseInt(network.cidr.split('/')[1], 10) : prefixFromNetmask(network.netmask);
      const address = toInteger(network.address);
      const scanPrefix = prefix < 24 ? 24 : prefix;
      const mask = scanPrefix === 0 ? 0 : (0xffffffff << (32 - scanPrefix)) >>> 0;
      const start = (address & mask) >>> 0;
      const end = (start | (~mask >>> 0)) >>> 0;
      const scanEnd = Math.min(end - 1, start + 254);
      const networkHosts = [];

      for (let current = start + 1; current <= scanEnd; current++) {
        const ip = fromInteger(current);

        if (ip !== network.address) {
          hosts.add(ip);
          networkHosts.push(ip);
        }
      }

      if (networkHosts.length) {
        networks.push({
          name,
          address: network.address,
          cidr: network.cidr || `${network.address}/${prefix}`,
          scanCidr: `${fromInteger(start)}/${scanPrefix}`,
          startIp: networkHosts[0],
          endIp: networkHosts[networkHosts.length - 1],
          hostCount: networkHosts.length,
        });
      }
    }
  }

  return {
    hosts: [...hosts],
    networks,
  };
};

const getStreamUriBody = (profileToken) =>
  envelope(
    `<GetStreamUri xmlns="http://www.onvif.org/ver10/media/wsdl"><StreamSetup><Stream xmlns="http://www.onvif.org/ver10/schema">RTP-Unicast</Stream><Transport xmlns="http://www.onvif.org/ver10/schema"><Protocol>RTSP</Protocol></Transport></StreamSetup><ProfileToken>${profileToken}</ProfileToken></GetStreamUri>`
  );

const probeEndpoint = async (host, port) => {
  for (const path of ONVIF_PATHS) {
    const response = await requestOnvif(host, port, path, getSystemDateAndTimeBody);

    if (isOnvifResponse(response)) {
      return {
        host,
        port,
        path,
        authRequired: response.status === 401 || /Unauthorized|Authentication/i.test(response.data || ''),
        server: response.server,
      };
    }
  }

  return null;
};

const inspectEndpoint = async (endpoint, credentials = {}) => {
  const info = await requestOnvif(endpoint.host, endpoint.port, endpoint.path, getDeviceInformationBody, credentials);
  const profiles = await requestOnvif(endpoint.host, endpoint.port, endpoint.path, getProfilesBody, credentials);
  const tokens = [...new Set(attributeValues(profiles.data, 'Profiles', 'token'))];
  const streams = [];

  for (const token of tokens.slice(0, 4)) {
    const stream = await requestOnvif(endpoint.host, endpoint.port, endpoint.path, getStreamUriBody(token), credentials);
    const uri = tagValue(stream.data, 'Uri');

    if (uri) {
      streams.push({
        token,
        uri,
        displayUri: redactUri(uri),
        source: `-i ${uri}`,
      });
    }
  }

  return {
    ip: endpoint.host,
    port: endpoint.port,
    path: endpoint.path,
    server: endpoint.server || info.server || '',
    authRequired: endpoint.authRequired || info.status === 401 || profiles.status === 401,
    authenticated: !!(credentials.username || credentials.password) && info.status !== 401 && profiles.status !== 401,
    manufacturer: tagValue(info.data, 'Manufacturer'),
    model: tagValue(info.data, 'Model'),
    firmwareVersion: tagValue(info.data, 'FirmwareVersion'),
    serialNumber: tagValue(info.data, 'SerialNumber'),
    streams,
  };
};

export const inspectDevice = async ({ ip, port, path, username = '', password = '' }) => {
  const normalizedPort = Number.parseInt(port, 10);

  if (!ip || !normalizedPort || !path) {
    throw inputError('ONVIF IP, port, and path are required');
  }

  if (!isPrivateCameraIp(ip)) {
    throw inputError('ONVIF inspection is limited to private IPv4 camera addresses');
  }

  if (!DEFAULT_PORT_SET.has(normalizedPort)) {
    throw inputError(`ONVIF inspection is limited to these ports: ${DEFAULT_PORTS.join(', ')}`);
  }

  if (!ONVIF_PATHS.includes(path)) {
    throw inputError('Unsupported ONVIF service path');
  }

  return inspectEndpoint(
    {
      host: ip,
      port: normalizedPort,
      path,
      authRequired: true,
      server: '',
    },
    {
      username,
      password,
    }
  );
};

export const discover = async (ports = DEFAULT_PORTS) => {
  const scanPorts = normalizePorts(ports);
  const targets = getDhcpLanScanTargets();
  const hosts = targets.hosts;
  const jobs = [];
  const endpoints = [];
  let index = 0;

  for (const host of hosts) {
    if (!isPrivateCameraIp(host)) {
      continue;
    }

    for (const port of scanPorts) {
      jobs.push({ host, port });
    }
  }

  const worker = async () => {
    while (index < jobs.length) {
      const job = jobs[index++];
      const endpoint = await probeEndpoint(job.host, job.port);

      if (endpoint) {
        endpoints.push(endpoint);
      }
    }
  };

  await Promise.all(Array.from({ length: DISCOVERY_CONCURRENCY }, worker));

  const devices = await Promise.all(
    endpoints
      .sort((a, b) => a.host.localeCompare(b.host, undefined, { numeric: true }) || a.port - b.port)
      .map((endpoint) => inspectEndpoint(endpoint))
  );

  return {
    devices,
    scan: {
      mode: 'dhcp-lan',
      ports: scanPorts,
      hostCount: hosts.length,
      networks: targets.networks,
    },
  };
};
