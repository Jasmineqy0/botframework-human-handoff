const { BotAdapter } = require('botbuilder');

class ChatwootAdapter extends BotAdapter {
    constructor(chatwootConfiguration = null) {
        super();
        this.chatwootConfiguration = chatwootConfiguration;
    }

    async processActivity(req, res, logic) {
        throw new Error('Method not implemented.');
    }
    continueConversation(reference, logic) {
        throw new Error('Method not implemented.');
    }
    deleteActivity(context, reference) {
        throw new Error('Method not implemented.');
    }
    updateActivity(context, activity) {
        throw new Error('Method not implemented.');
    }
    async sendActivities(context, activities) {
        throw new Error('Method not implemented.');
    }
    runMiddleware(context, next) {
        return super.runMiddleware(context, next);
    }
}

module.exports.ChatwootAdapter = ChatwootAdapter;
