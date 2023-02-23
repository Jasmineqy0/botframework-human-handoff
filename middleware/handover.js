const { ActivityTypes, TurnContext, CardFactory } = require('botbuilder');
const { localDb } = require('../levelDb/levelDb');
const { replyMenu } = require('../resources/agentMenuReply');

const UserState = {
    Bot: 'BOT',
    Queued: 'QUEUED',
    Agent: 'AGENT'
};

class HandoverMiddleware {
    /**
   *
   * @param {ArrayHandoverProvider} provider
   * @param {BotFrameworkAdapter} adapter
   */
    constructor(provider, adapter) {
        this.provider = provider;
        this.adapter = adapter;
    }

    /**
   *
   * @param {TurnContext} turnContext
   * @param {*} next
   */
    async onTurn(turnContext, next) {
        if (turnContext.activity.type !== ActivityTypes.Message) { return await next(); }

        if (turnContext.activity.from.id.toLowerCase().startsWith('agent')) {
            await this.manageAgent(turnContext, next);
        } else {
            await this.manageUser(turnContext, next);
        }
    }

    /**
   *
   * @param {ArrayHandoverProvider} turnContext
   * @param {*} next
   */
    async manageUser(turnContext, next) {
        const conversationReference = TurnContext.getConversationReference(turnContext.activity);
        const user = await this.provider.findOrCreate(conversationReference);
        // await this.provider.log((user, conversationReference.user.name, turnContext.activity.text));

        const { activity: { text } } = turnContext;

        if (user.state === UserState.Agent) {
            await this.adapter.continueConversation(user.agentReference, async agentContext => {
                await agentContext.sendActivity(turnContext.activity.text);
            });
        }

        switch (text.toLowerCase()) {
        case 'agent':
            if (user.state === UserState.Bot) {
                await this.provider.queueForAgent(conversationReference);
                await turnContext.sendActivity('Please wait while we try to connect you to an agent.');
            } else {
                await turnContext.sendActivity('You are already connected to an agent.');
            }
            break;
        case 'cancel':
            if (user.state === UserState.Agent) {
                await this.provider.unqueueForAgent(conversationReference);
                await turnContext.sendActivity('You are now reconnected to the bot!');
                break;
            } else {
                return await next();
            }
        default:
            return await next();
        }
    }

    /**
   *
   * @param {TurnConext} turnContext
   * @param {*} next
   */
    async manageAgent(turnContext, next) {
        const conversationReference = TurnContext.getConversationReference(turnContext.activity);
        const user = await this.provider.findByAgent(conversationReference);
        const { activity: { text } } = turnContext;

        switch (text) {
        case '#list':
            const replyList = this.createListReply(this.provider.getQueue());

            await turnContext.sendActivity(replyList);

            break;
        case '#connect':
            if (user && user.state === UserState.Agent) {
                await turnContext.sendActivity('You are already connected to a user.');
            } else {
                const user = await this.provider.connectToAgent(conversationReference);
                if (user) {
                    await turnContext.sendActivity(`You are now successfully connected to ${ user.userReference.user.name }.`);

                    const transcript = await this.getTranscript(user.userReference.conversation.id);

                    const replyTranscript = this.createTranscriptReply(user.userReference.user.name, transcript);

                    await turnContext.sendActivity(replyTranscript);

                    await this.adapter.continueConversation(user.userReference, async userContext => {
                        await userContext.sendActivity('You are now connected to an agent!');
                    });
                } else {
                    await turnContext.sendActivity('There are no users in the Queue right now.');
                }
            }
            break;
        case '#disconnect':
            if (user && user.state === UserState.Agent) {
                this.provider.disconnectFromAgent(conversationReference);
                await turnContext.sendActivity('You have been disconnected from the user.');
                await this.adapter.continueConversation(user.userReference, async userContext => {
                    await userContext.sendActivity('The agent disconnected from the conversation. You are now reconnected to the bot.');
                });
            } else {
                await turnContext.sendActivity('You are not connected to a user.');
            }
            break;
        case 'menu':
            await turnContext.sendActivity(replyMenu);
            break;
        default:
            break;
        }

        if (user && user.state === UserState.Agent) {
            this.adapter.continueConversation(user.userReference, async turnContext => {
                await turnContext.sendActivity(text);
            });
        }
    }

    async getTranscript(convID) {
        try {
            var convId = convID;
            if (convId.indexOf('|') !== -1) {
                convId = convID.replace(/\|.*/, '');
            }
            var transcript = await localDb.get(convId);
        } catch (err) {
            console.log(err);
        }

        return transcript;
    }

    createTranscriptReply(name, transcript) {
        const replyTranscript = { type: ActivityTypes.Message };

        const transcriptBlocks = transcript.map((item, idx) =>
            ({ 'type': 'TextBlock',
                'text': `${ item[0] }: ${ item[1] }`,
                'wrap': true }));
        const transcriptCard = CardFactory.adaptiveCard({
            '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
            'type': 'AdaptiveCard',
            'version': '1.0',
            'body': [
                {
                    'type': 'TextBlock',
                    'text': `Customer ${ name }'s Transcript:`,
                    'size': 'large'
                }
            ].concat(transcriptBlocks)
        });
        replyTranscript.attachments = [transcriptCard];

        return replyTranscript;
    }

    createListReply(queue) {
        const replyList = { type: ActivityTypes.Message };

        const customerBlocks = queue.length !== 0 ? queue.map((user, idx) =>
            ({ 'type': 'TextBlock', 'text': `${ idx }. ${ user.userReference.user.name }` })) : '';

        const listCard = CardFactory.adaptiveCard({
            '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
            'type': 'AdaptiveCard',
            'version': '1.0',
            'body': [
                {
                    'type': 'TextBlock',
                    'text': 'List of Queued Customers:',
                    'size': 'large'
                }
            ].concat(customerBlocks)
        });
        replyList.attachments = [listCard];

        return replyList;
    }
}

class ArrayHandoverProvider {
    constructor(backingStore = []) {
        this.backingStore = backingStore;
    }

    async findOrCreate(userReference) {
        let result = this.backingStore.find(u => u.userReference.user.id === userReference.user.id);

        if (result) {
            return result;
        }

        result = {
            userReference,
            state: UserState.Bot,
            messages: []
        };

        this.backingStore.push(result);
        return result;
    }

    async log(user, from, text) {
        user.messages.push({ from, text });
        console.log(this.backingStore);
        return user;
    }

    async findByAgent(agentReference) {
        const result = this.backingStore.find(u => u.agentReference && u.agentReference.user.id === agentReference.user.id);
        return result || null;
    }

    async queueForAgent(userReference) {
        const user = await this.findOrCreate(userReference);
        user.state = UserState.Queued;
        user.queueTime = new Date();
        return user;
    }

    async unqueueForAgent(userReference) {
        const user = await this.findOrCreate(userReference);
        user.state = UserState.Bot;
        user.queueTime = null;
        return user;
    }

    async connectToAgent(agentReference) {
        const queue = this.getQueue();
        if (queue.length > 0) {
            const user = queue[0];
            user.state = UserState.Agent;
            user.queueTime = null;
            user.agentReference = agentReference;
            return user;
        }
    }

    async disconnectFromAgent(agentReference) {
        const user = await this.findByAgent(agentReference);
        user.state = UserState.Bot;
        user.agentContext = null;
        user.queueTime = null;
        return user;
    }

    getQueue() {
        return this.backingStore
            .filter(u => u.state === UserState.Queued)
            .sort(u => u.queueTime.getTime());
    }
}

module.exports.ArrayHandoverProvider = ArrayHandoverProvider;
module.exports.HandoverMiddleware = HandoverMiddleware;
