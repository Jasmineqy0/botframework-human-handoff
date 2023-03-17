/* eslint-disable camelcase */
const dotenv = require('dotenv');
const { createContact, createConversation, createMessage } = require('../chatwoot/chatwootAPI');
const { ActivityTypes, TurnContext, BotFrameworkAdapter } = require('botbuilder');
const { ChatwootAdapter } = require('../chatwoot/chatwootAdapter');
const { localDb } = require('../levelDb/levelDb');
const path = require('path');
const ENV_FILE = path.join(path.dirname(__dirname), '.env');
dotenv.config({ path: ENV_FILE });

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
        let adapterType =
        (turnContext.adapter instanceof BotFrameworkAdapter) ? 'BotFrameworkAdapter'
            : (turnContext.adapter instanceof ChatwootAdapter) ? 'chatwootAdapter'
                : Object.prototype.toString.call(turnContext.adapter);

        if (turnContext.activity.type !== ActivityTypes.Message) {
            return await next();
        }

        if (adapterType === 'chatwootAdapter') {
            await this.manageAgent(turnContext, next);
        } else if (adapterType === 'BotFrameworkAdapter') {
            await this.manageUser(turnContext, next);
        } else {
            console.error(`Unknown adapter type: ${ adapterType }`);
            await next();
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

        const { activity: { text } } = turnContext;

        // check the text contect from user
        switch (text.toLowerCase()) {
        case 'talk to human': // mimic detected intent to connect to agent
            // initiate handover for bot status
            if (user.state === UserState.Bot) {
                await this.provider.unqueueForAgent(conversationReference);

                await turnContext.sendActivity('Please wait while we try to connect you to an agent.');

                const clientName = turnContext.activity.from.name;
                const clientId = turnContext.activity.from.id;

                try {
                    // usec chatwoot API to create contact and conversation
                    const [sourceId] = await createContact(process.env.chatwootHost, process.env.chatwootPort, clientId, clientName, process.env.inboxId);
                    const conversationId = await createConversation(process.env.chatwootHost, process.env.chatwootPort, clientId, clientName, process.env.inboxId, sourceId);

                    await this.provider.queueForAgent(conversationReference, sourceId, conversationId);

                    // get the transcript from local storage and send it to chatwoot
                    var convId = user.userReference.conversation.id;
                    if (convId.indexOf('|') !== -1) {
                        convId = user.userReference.conversation.id.replace(/\|.*/, '');
                    }
                    let transcript = await localDb.get(`transcript_${ convId }`);
                    transcript = transcript.join('\n');
                    await createMessage(process.env.chatwootHost, process.env.chatwootPort, process.env.inboxId, sourceId, conversationId, transcript);
                } catch (err) {
                    console.log(err);
                }
            // ask the user to be patient in queued status
            } else if (user.state === UserState.Queued) {
                await turnContext.sendActivity('You are already in the queue, Please wait while we try to connect you to an agent.');
            // send the message to the agent and tell user that they are already connected to an agent
            } else {
                await createMessage(process.env.chatwootHost, process.env.chatwootPort, process.env.inboxId, user.sourceId, user.conversationId, text);
                await turnContext.sendActivity('You are already connected to an agent.');
            }
            break;
        case 'cancel': // mimic detected intent to cancel handover
            // do nothing and continue to talk to the bot if user is already in bot status
            if (user.state === UserState.Bot) {
                await next();
            // remove the user from queue if the user is in queued or agent status
            } else if (user.state === UserState.Queued) {
                await this.provider.unqueueForAgent(conversationReference);
                await turnContext.sendActivity('You are now reconnected to the bot!');
            } else {
                await this.provider.unqueueForAgent(conversationReference);
                await createMessage(process.env.chatwootHost, process.env.chatwootPort, process.env.inboxId, user.sourceId, user.conversationId, 'The User has terminated the conversation');
                await turnContext.sendActivity('You are now reconnected to the bot!');
            }
            break;
        default:
            // do nothing and continue to talk to the bot
            if (user.state === UserState.Bot) {
                await next();
            // ask the user to be patient in queued status
            } else if (user.state === UserState.Queued) {
                await turnContext.sendActivity('You are already in the queue, Please wait while we try to connect you to an agent.');
            // send the message to the agent if the user is in agent status
            } else {
                await createMessage(process.env.chatwootHost, process.env.chatwootPort, process.env.inboxId, user.sourceId, user.conversationId, text);
            }
        }
    }

    /**
   *
   * @param {TurnConext} turnContext
   * @param {*} next
   */
    async manageAgent(turnContext, next) {
        const conversationReference = TurnContext.getConversationReference(turnContext.activity);
        let user = await this.provider.findByAgent(conversationReference);
        const { activity: { text } } = turnContext;

        if (user) {
            if (user.state === UserState.Agent) {
                if (text === 'disconnect') {
                    this.provider.disconnectFromAgent(conversationReference);
                    return this.adapter.continueConversation(user.userReference, async turnContext => {
                        await turnContext.sendActivity('The agent disconnected from the conversation');
                    });
                } else {
                    return this.adapter.continueConversation(user.userReference, async turnContext => {
                        await turnContext.sendActivity(text);
                    });
                }
            }
        } else {
            user = await this.provider.connectToAgent(conversationReference);
            if (user) {
                this.adapter.continueConversation(user.userReference, async turnContext => {
                    await turnContext.sendActivity(`You are now connected to agent ${ conversationReference.conversation.name }.`);
                });
                return this.adapter.continueConversation(user.userReference, async turnContext => {
                    await turnContext.sendActivity(text);
                });
            } else {
                console.log('No user found');
            }
        }
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
        const result = this.backingStore.find(u => u.agentReference && u.agentReference.conversation.id === agentReference.conversation.id);
        return result || null;
    }

    async queueForAgent(userReference, sourceId, conversationId) {
        const user = await this.findOrCreate(userReference);
        user.sourceId = sourceId;
        user.conversationId = conversationId;
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
