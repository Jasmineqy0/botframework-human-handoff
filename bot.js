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
            for (const { name } of membersAdded) {
                if (name !== 'Bot') {
                    const reply = MessageFactory.suggestedActions(['talk to human'], "Welcome to the Human Handover Middleware Example. You are currently communicating to the bot as a user. To connect to agent, send 'talk to human.'");
                    await turnContext.sendActivity(reply);
                }
            }
        } else {
            await turnContext.sendActivity(`[${ turnContext.activity.type } event detected]`);
        }
    }
}

module.exports.MyBot = MyBot;
