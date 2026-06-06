/* eslint-disable unicorn/better-regex */
/* eslint-disable unicorn/escape-case */
/* eslint-disable no-control-regex */
/* eslint-disable unicorn/no-hex-escape */
/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import axios from 'axios';
import { exec } from 'child_process';
import compareVersions from 'compare-versions';
import fs from 'fs-extra';
import path from 'path';
import systeminformation from 'systeminformation';

import LoggerService from '../../../services/logger/logger.service.js';
import ConfigService from '../../../services/config/config.service.js';

import Database from '../../database.js';
import Socket from '../../socket.js';

import MotionController from '../../../controller/motion/motion.controller.js';

const { log } = LoggerService;

let updating = false;

const SOURCE_REPOSITORY = {
  branch: 'master',
  name: 'zombrax1/camera.ui',
  url: 'https://github.com/zombrax1/camera.ui.git',
};

const SOURCE_REPOSITORY_API = `https://api.github.com/repos/${SOURCE_REPOSITORY.name}`;
const SOURCE_REPOSITORY_RELEASE_URL = `${SOURCE_REPOSITORY_API}/releases`;
const SOURCE_REPOSITORY_TAG_URL = `${SOURCE_REPOSITORY_API}/tags`;

const setTimeoutAsync = (ms) => new Promise((res) => setTimeout(res, ms));

const normalizeVersion = (version) => version?.toString().trim().replace(/^v/i, '');

const sortVersions = (versions) => {
  return [...new Set(versions.filter((version) => compareVersions.validate(version)))].sort((a, b) => {
    if (compareVersions.compare(a, b, '>')) {
      return -1;
    }

    if (compareVersions.compare(a, b, '<')) {
      return 1;
    }

    return 0;
  });
};

const getSourceVersions = async () => {
  try {
    const response = await axios(SOURCE_REPOSITORY_RELEASE_URL, {
      headers: {
        accept: 'application/vnd.github+json',
      },
    });

    const releaseVersions = response.data
      .filter((release) => !release.draft)
      .map((release) => normalizeVersion(release.tag_name));

    const versions = sortVersions([...releaseVersions, ConfigService.version]);

    if (versions.length > 0) {
      return versions;
    }
  } catch (error) {
    log.warn(`Failed to fetch GitHub releases: ${error.message}`, 'System', 'system');
  }

  try {
    const response = await axios(SOURCE_REPOSITORY_TAG_URL, {
      headers: {
        accept: 'application/vnd.github+json',
      },
    });

    return sortVersions([...response.data.map((tag) => normalizeVersion(tag.name)), ConfigService.version]);
  } catch (error) {
    log.warn(`Failed to fetch GitHub tags: ${error.message}`, 'System', 'system');
  }

  return [ConfigService.version];
};

const runUpdateCommand = (cmd, options = {}) => {
  return new Promise((resolve, reject) => {
    log.info(`Updating: ${cmd}`, 'System', 'system');

    exec(
      cmd,
      {
        maxBuffer: 50 * 1024 * 1024,
        windowsHide: true,
        ...options,
      },
      (error, stdout, stderr) => {
        if (stdout) {
          log.info(stdout.trim(), 'System', 'system');
        }

        if (stderr) {
          log.warn(stderr.trim(), 'System', 'system');
        }

        if (error) {
          return reject(error);
        }

        resolve(true);
      }
    );
  });
};

const withLegacyOpenSsl = () => {
  const nodeOptions = process.env.NODE_OPTIONS || '';

  if (nodeOptions.includes('--openssl-legacy-provider')) {
    return process.env;
  }

  return {
    ...process.env,
    NODE_OPTIONS: `${nodeOptions} --openssl-legacy-provider`.trim(),
  };
};

const updateFromSourceRepository = async () => {
  updating = true;

  try {
    const basePath = process.env.CUI_BASE_PATH || process.cwd();
    const gitPath = path.resolve(basePath, '.git');

    if (!(await fs.pathExists(gitPath))) {
      throw new Error(`Source update requires a git checkout. Missing ${gitPath}`);
    }

    try {
      await runUpdateCommand('git remote get-url origin', { cwd: basePath });
    } catch {
      await runUpdateCommand(`git remote add origin ${SOURCE_REPOSITORY.url}`, { cwd: basePath });
    }

    await runUpdateCommand(`git remote set-url origin ${SOURCE_REPOSITORY.url}`, { cwd: basePath });
    await runUpdateCommand(`git fetch origin ${SOURCE_REPOSITORY.branch} --tags`, { cwd: basePath });
    await runUpdateCommand(`git pull --ff-only origin ${SOURCE_REPOSITORY.branch}`, { cwd: basePath });
    await runUpdateCommand('npm install', { cwd: basePath });
    await runUpdateCommand('npm install --prefix ui --legacy-peer-deps', { cwd: basePath });
    await runUpdateCommand('npm run build --prefix ui', {
      cwd: basePath,
      env: withLegacyOpenSsl(),
    });

    log.info('Successfully updated from source repository!', 'System', 'system');

    return true;
  } finally {
    updating = false;
  }
};

export const clearLog = async (req, res) => {
  try {
    const logPath = ConfigService.logFile;
    fs.truncate(logPath, (err) => {
      if (err) {
        return res.status(500).send({
          statusCode: 500,
          message: err.message,
        });
      }

      Socket.io.emit('clearLog');
      res.status(204).send({});
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const downloadDb = async (req, res, next) => {
  try {
    const dbPath = ConfigService.databaseFilePath;
    //const dbJson = JSON.stringify((await fs.readJSON(dbPath, { throws: false })) || {});

    res.header('Content-Type', 'application/json');
    res.sendFile(dbPath, (err) => {
      if (err) {
        if (err?.status === 404 || err?.statusCode === 404) {
          log.debug(err.message);
        }

        next();
      }
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const downloadLog = async (req, res) => {
  try {
    const logPath = ConfigService.logFile;
    //res.download(logPath);

    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', 'attachment; filename=camera.ui.log.txt');

    const readStream = fs.createReadStream(logPath);

    readStream.on('data', (data) => {
      res.write(data.toString().replace(/\x1b\[[0-9;]*m/g, ''));
    });

    readStream.on('end', async () => {
      res.status(200).send();
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const fetchNpm = async (req, res) => {
  try {
    const versions = await getSourceVersions();
    const versionMap = versions.reduce((data, version) => {
      data[version] = {
        name: SOURCE_REPOSITORY.name,
        version,
      };

      return data;
    }, {});

    res.status(200).send({
      name: SOURCE_REPOSITORY.name,
      'dist-tags': {
        latest: versions[0] || ConfigService.version,
      },
      repository: {
        type: 'git',
        url: SOURCE_REPOSITORY.url,
      },
      versions: versionMap,
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getChangelog = async (req, res) => {
  try {
    const version = normalizeVersion(req.query.version || ConfigService.version);
    const tagName = `v${version}`;

    try {
      const response = await axios(`${SOURCE_REPOSITORY_RELEASE_URL}/tags/${tagName}`, {
        headers: {
          accept: 'application/vnd.github+json',
        },
      });

      const release = response.data;
      const releaseNotes = release.body?.trim() || `No release notes were published for ${tagName}.`;

      return res.status(200).send(`# ${release.name || tagName}\n\n${releaseNotes}`);
    } catch (error) {
      log.warn(`Failed to fetch GitHub release notes: ${error.message}`, 'System', 'system');
    }

    res.status(200).send(`No release notes were found for ${tagName}.`);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getDiskLoad = async (req, res) => {
  try {
    await Socket.handleDiskUsage();
    res.status(200).send(Socket.diskSpace);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getFtpServerStatus = async (req, res) => {
  try {
    const status = MotionController.ftpServer.server.listening;

    res.status(200).send({
      status: status ? 'online' : 'offline',
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getHttpServerStatus = async (req, res) => {
  try {
    const status = MotionController.httpServer.listening;

    res.status(200).send({
      status: status ? 'online' : 'offline',
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getLog = async (req, res) => {
  try {
    const logPath = ConfigService.logFile;
    const truncateSize = 200000;
    const logStats = await fs.stat(logPath);
    const logStartPosition = logStats.size - truncateSize;
    const logBuffer = Buffer.alloc(truncateSize);

    const fd = await fs.open(logPath, 'r');
    // eslint-disable-next-line no-unused-vars
    const { bytesRead, buffer } = await fs.read(fd, logBuffer, 0, truncateSize, logStartPosition);

    res.status(200).send(buffer.toString());
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getMqttClientStatus = async (req, res) => {
  try {
    const status = MotionController.mqttClient.connected;

    res.status(200).send({
      status: status ? 'online' : 'offline',
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getSmtpServerStatus = async (req, res) => {
  try {
    const status = MotionController.smtpServer.server.listening;

    res.status(200).send({
      status: status ? 'online' : 'offline',
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getUptime = async (req, res) => {
  try {
    const humaniseDuration = (seconds) => {
      if (seconds < 50) {
        return '0m';
      }
      if (seconds < 3600) {
        return Math.round(seconds / 60) + 'm';
      }
      if (seconds < 86400) {
        return Math.round(seconds / 60 / 60) + 'h';
      }
      return Math.floor(seconds / 60 / 60 / 24) + 'd';
    };

    const systemTime = await systeminformation.time();
    const processUptime = process.uptime();

    res.status(200).send({
      systemTime: humaniseDuration(systemTime ? systemTime.uptime : 0),
      processTime: humaniseDuration(processUptime),
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const lastModifiedDb = async (req, res) => {
  try {
    const dbPath = ConfigService.databaseFilePath;
    const dbFileInfo = await fs.stat(dbPath);

    res.status(200).send(dbFileInfo);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const restartFtpServer = async (req, res) => {
  try {
    MotionController.closeFtpServer();
    await setTimeoutAsync(1000);

    MotionController.startFtpServer();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const restarHttpServer = async (req, res) => {
  try {
    MotionController.closeHttpServer();
    await setTimeoutAsync(1000);

    MotionController.startHttpServer();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const restartMqttClient = async (req, res) => {
  try {
    MotionController.closeMqttClient();
    await setTimeoutAsync(1000);

    MotionController.startMqttClient();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const restartSmtpServer = async (req, res) => {
  try {
    MotionController.closeSmtpServer();
    await setTimeoutAsync(1000);

    MotionController.startSmtpServer();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const restartSystem = async (req, res) => {
  try {
    Database.controller.emit('restart');
    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const stopFtpServer = async (req, res) => {
  try {
    MotionController.closeFtpServer();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const stopHttpServer = async (req, res) => {
  try {
    MotionController.closeHttpServer();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const stopMqttClient = async (req, res) => {
  try {
    MotionController.closeMqttClient();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const stopSmtpServer = async (req, res) => {
  try {
    MotionController.closeSmtpServer();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const updateSystem = async (req, res) => {
  try {
    if (updating) {
      return res.status(500).send({
        statusCode: 500,
        message: 'System update is already in progress',
      });
    }

    const timeout = 5 * 60 * 1000; //5min
    req.setTimeout(timeout);
    res.setTimeout(timeout);

    await updateFromSourceRepository(req.query.version);

    Database.controller.emit('updated');
    Socket.io.emit('updated');

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
