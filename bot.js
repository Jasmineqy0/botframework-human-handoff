// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityTypes, MessageFactory } = require('botbuilder');

class MyBot {
    /**
     *
     * @param {TurnContext} on turn context object.
     */
    async onTurn(turnContext) {
        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        if (turnContext.activity.type === ActivityTypes.Message) {
            await turnContext.sendActivity(`You said '${ turnContext.activity.text }'`);
        } else if (turnContext.activity.type === ActivityTypes.ConversationUpdate) {
            const { membersAdded } = turnContext.activity;
            for (const member of membersAdded) {
                if (member.id.toLowerCase().startsWith('agent')) {
                    const reply = MessageFactory.suggestedActions(['menu'], "Welcome to the Human Handoff Middleware Example. You are currently communicating to the bot as an agent. To see a list of available functions, message 'menu'");
                    await turnContext.sendActivity(reply);
                } else if (member.name === 'User') {
                    const reply = MessageFactory.suggestedActions(['agent'], "Welcome to the Human Handoff Middleware Example. You are currently communicating to the bot as a user. To connect to agent, send 'agent'");
                    await turnContext.sendActivity(reply);
                }
            }
        } else {
            await turnContext.sendActivity(`[${ turnContext.activity.type } event detected]`);
        }
    }
}

module.exports.MyBot = MyBot;
