const { localDb } = require('../levelDb/levelDb');
const path = require('path');

/**
 * CustomLogger, takes in an activity and saves it for the duration of the conversation to levelDB
 */
class CustomLogger {
    /**
     * Log an activity to the log file.
     * @param activity Activity being logged.
     */
    constructor() {
        // levelDB instance
        this.transcriptStorage = localDb;
        // initialize empty object to store conversation logs
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
                // get the conversation id
                var convId = activity.conversation.id;
                if (convId.indexOf('|') !== -1) {
                    convId = activity.conversation.id.replace(/\|.*/, '');
                }

                // create a file name for the conversation, here we use the conversation id
                var fileName = `${ convId }`;

                // create a new array for the conversation if it doesn't exist
                if (!(fileName in this.conversationLogger)) {
                    this.conversationLogger[fileName] = [];
                }

                this.conversationLogger[fileName].push(logTextDb);

                // update the conversation array
                const updateObj = this.conversationLogger[fileName];

                // Add delay to ensure messages logged sequentially
                await this.wait(this.msDelay);

                try {
                    // save the conversation array to levelDB
                    await this.transcriptStorage.put(fileName, updateObj);
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
