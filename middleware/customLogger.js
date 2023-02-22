// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { localDb } = require('../levelDb/levelDb');
const path = require('path');

/**
 * CustomLogger, takes in an activity and saves it for the duration of the conversation, writing to an emulator compatible transcript file in the transcriptsPath folder.
 */
class CustomLogger {
    /**
     * Log an activity to the log file.
     * @param activity Activity being logged.
     */

    // Set up Cosmos Storage
    constructor() {
        this.transcriptStorage = localDb;
        this.conversationLogger = {};

        this.msDelay = 250;
    }

    async logActivity(activity) {
        if (!activity) {
            throw new Error('Activity is required.');
        }

        // Log only if this is type message
        if (activity.type === 'message') {
            const logTextDb = activity.attachments
                ? [ activity.from.name, activity.attachments[0].content.text ]
                : [ activity.from.name, activity.text ];

            if (activity.conversation) {
                var convId = activity.conversation.id;
                if (convId.indexOf('|') !== -1) {
                    convId = activity.conversation.id.replace(/\|.*/, '');
                }

                // // Get today's date for datestamp
                // var currentDate = new Date();
                // var day = currentDate.getDate();
                // var month = currentDate.getMonth() + 1;
                // var year = currentDate.getFullYear();
                // var datestamp = year + '-' + month + '-' + day;

                var fileName = `${ convId }`;

                // var timestamp = Math.floor(Date.now() / 1);

                if (!(fileName in this.conversationLogger)) {
                    this.conversationLogger[fileName] = [];
                    // this.conversationLogger[fileName].botName = process.env.BOTNAME;
                }

                // this.conversationLogger[fileName][timestamp] = logTextDb;
                this.conversationLogger[fileName].push(logTextDb);

                const updateObj = this.conversationLogger[fileName];

                // Add delay to ensure messages logged sequentially
                await this.wait(this.msDelay);

                try {
                    await this.transcriptStorage.put(fileName, updateObj);
                    // console.log('Transcript updated');
                    // console.log(await this.transcriptStorage.get(fileName));
                } catch (err) {
                    console.log({ message: `Logger ${ err.name } - ${ path.basename(__filename) }`, severity: 3, properties: { botName: process.env.BOTNAME, error: err.message, callStack: err.stack } });
                }
            }
        }
    }

    async wait(milliseconds) {
        var start = new Date().getTime();
        for (var i = 0; i < 1e7; i++) {
            if ((new Date().getTime() - start) > milliseconds) {
                break;
            }
        }
    }
}
exports.CustomLogger = CustomLogger;
