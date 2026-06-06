/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import fs from 'fs-extra';
import axios from 'axios';
import FormData from 'form-data';

import LoggerService from '../services/logger/logger.service.js';

const { log } = LoggerService;

export default class Telegram {
  static bot = null;
  static token = null;

  constructor() {}

  static async start(telegramConfig) {
    if (Telegram.bot) {
      return Telegram.bot;
    }

    log.debug('Connecting to Telegram...');

    Telegram.token = telegramConfig.token;
    Telegram.bot = {
      close: async () => {},
    };

    return Telegram.bot;
  }

  static async stop() {
    if (Telegram.bot) {
      log.debug('Stopping Telegram...');
      await Telegram.bot.close();
      Telegram.bot = null;
      Telegram.token = null;
    }
  }

  static #url(method) {
    return `https://api.telegram.org/bot${Telegram.token}/${method}`;
  }

  static async #post(method, body) {
    await axios.post(Telegram.#url(method), body, { timeout: 30000 });
  }

  static async #postFile(method, chatID, field, file, fileName) {
    const form = new FormData();

    form.append('chat_id', chatID);
    form.append(field, file, fileName ? { filename: fileName } : undefined);

    await axios.post(Telegram.#url(method), form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 30000,
    });
  }

  static async send(chatID, content) {
    if (Telegram.bot) {
      if (content.message) {
        try {
          log.debug('Telegram: Sending Message');
          await Telegram.#post('sendMessage', {
            chat_id: chatID,
            text: content.message,
          });
        } catch (error) {
          log.info('An error occured during sending message!', 'Telegram', 'notifications');
          log.error(error?.message || error, 'Telegram', 'notifications');
        }
      }

      if (content.img) {
        try {
          log.debug('Telegram: Sending Image');
          const stream = Buffer.isBuffer(content.img) ? content.img : fs.createReadStream(content.img);
          await Telegram.#postFile('sendPhoto', chatID, 'photo', stream, content.fileName);
        } catch (error) {
          log.info('An error occured during sending image!', 'Telegram', 'notifications');
          log.error(error?.message || error, 'Telegram', 'notifications');
        }
      }

      if (content.video) {
        try {
          log.debug('Telegram: Sending Video');
          const stream = Buffer.isBuffer(content.video) ? content.video : fs.createReadStream(content.video);
          await Telegram.#postFile('sendVideo', chatID, 'video', stream, content.fileName);
        } catch (error) {
          log.info('An error occured during sending video!', 'Telegram', 'notifications');
          log.error(error?.message || error, 'Telegram', 'notifications');
        }
      }
    } else {
      log.warn('Can not send Telegram notification, bot is not initialized!', 'Telegram', 'notifications');
    }
  }
}
